import { getEnv } from "@/lib/config/env";
import { AppError, AIProviderError, AIValidationError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import type { MercadoLibreItem } from "@/lib/ml/types";
import type { AIProvider } from "@/lib/ai/types";
import { fingerprintSchema, type ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
import type { AIMatchResult } from "@/lib/ai/schemas/matching";
import { buildFingerprintPrompt } from "@/lib/ai/prompts/fingerprint";

/**
 * Proveedor Gemini (TODO §16, §37, §40).
 * Usa la API REST de Generative Language con fetch nativo. El JSON generado
 * se valida con Zod y se reintenta una vez ante respuestas transitorias.
 */

const GENERATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const FINGERPRINT_REPAIR_NOTE =
  "\n\nIMPORTANTE: tu respuesta anterior no cumplió el esquema JSON requerido. Devuelve únicamente un objeto JSON válido con las claves exactas del esquema, sin texto adicional, sin comillas de código ni campos extra.";

const HTTP_ATTEMPTS = 2;
const SCHEMA_ATTEMPTS = 2;

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  return Math.min(1500, 300 * 2 ** (attempt - 1));
}

/** Extrae el texto plano del primer candidato de una respuesta generateContent. */
export function extractResponseText(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object") return null;
  const body = raw as { promptFeedback?: unknown; candidates?: unknown };
  const feedback = body.promptFeedback as { blockReason?: unknown } | null;
  if (feedback && feedback.blockReason) return null;
  if (!Array.isArray(body.candidates) || body.candidates.length === 0) return null;
  const first = body.candidates[0] as { finishReason?: unknown; content?: { parts?: unknown } };
  if (first.finishReason === "SAFETY" || first.finishReason === "MAX_TOKENS") return null;
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) return null;
  const texts: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") texts.push(text);
    }
  }
  return texts.join("") || null;
}

/** Parsea texto JSON tolerando fences de markdown. Devuelve null si no es JSON. */
export function parseJsonText(text: string): unknown {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/;
  const m = t.match(fence);
  if (m) t = m[1].trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  constructor(private readonly config: GeminiConfig) {}

  async createFingerprint(item: MercadoLibreItem): Promise<ProductFingerprint> {
    const prompt = buildFingerprintPrompt(item);
    let repair = "";
    for (let attempt = 0; attempt < SCHEMA_ATTEMPTS; attempt++) {
      const rawText = await this.generateContent(prompt.system, prompt.user + repair);
      const json = parseJsonText(rawText);
      if (json === null) {
        throw new AIValidationError("Gemini devolvió una respuesta no parseable.");
      }
      const parsed = fingerprintSchema.safeParse(json);
      if (parsed.success) return parsed.data;
      repair = FINGERPRINT_REPAIR_NOTE;
      logger.warn("ai.gemini.fingerprint_schema_retry", { attempt, itemId: item.id.rawId });
    }
    throw new AIValidationError("El fingerprint generado no cumplió el esquema esperado.");
  }

  // Fase 4: se implementa el matching. Por ahora el pipeline solo usa fingerprint.
  async matchCandidate(): Promise<AIMatchResult> {
    throw new AppError(
      "AI_MATCH_NOT_IMPLEMENTED",
      "El matching con Gemini se implementa en la Fase 4.",
      { status: 501 }
    );
  }

  private async generateContent(system: string, user: string): Promise<string> {
    const baseUrl = this.config.baseUrl ?? GENERATIVE_BASE_URL;
    const url =
      `${baseUrl}/models/${encodeURIComponent(this.config.model)}:generateContent` +
      `?key=${encodeURIComponent(this.config.apiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: this.config.temperature ?? 0.2,
        responseMimeType: "application/json",
      },
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= HTTP_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (cause) {
        lastError = new AIProviderError("No pudimos contactar a Gemini (timeout/red).", cause);
        if (attempt < HTTP_ATTEMPTS) {
          await sleep(backoff(attempt));
          continue;
        }
        break;
      }

      if (res.ok) {
        const raw = await res.json().catch(() => null);
        const text = extractResponseText(raw);
        if (text !== null && text !== "") return text;
        throw new AIValidationError("Gemini no devolvió contenido textual en su respuesta.");
      }

      if (res.status === 401 || res.status === 403) {
        throw new AIProviderError("Gemini rechazó el acceso. Revisa GEMINI_API_KEY.", new Error(`HTTP ${res.status}`));
      }

      if ((res.status === 429 || res.status >= 500) && attempt < HTTP_ATTEMPTS) {
        logger.warn("ai.gemini.http_retry", { status: res.status, attempt });
        await sleep(backoff(attempt));
        continue;
      }

      lastError = new AIProviderError(`Gemini respondió HTTP ${res.status}.`, new Error(`HTTP ${res.status}`));
      break;
    }

    throw lastError ?? new AIProviderError("Gemini no respondió correctamente.");
  }
}

/** Crea un proveedor Gemini desde el entorno; falla si falta la API key. */
export function createGeminiProvider(): GeminiProvider {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "Falta GEMINI_API_KEY. Configúrala en el entorno para analizar productos en vivo.",
      { status: 500 }
    );
  }
  return new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
}