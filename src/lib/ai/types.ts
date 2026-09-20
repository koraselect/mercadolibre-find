import type { MercadoLibreItem } from "@/lib/ml/types";
import type { ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
import type { AIMatchResult } from "@/lib/ai/schemas/matching";

/**
 * Contrato de proveedor de IA (TODO §15, §46).
 * Gemini y Grok implementan esta interfaz para que el pipeline nunca haga
 * `if (provider === "gemini")...` en el dominio.
 */

export const AI_PROVIDER_NAMES = ["gemini", "grok"] as const;
export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

export interface AIProvider {
  readonly name: AIProviderName;
  /**
   * Normaliza el producto fuente en un fingerprint machine-readable
   * (identidad del producto + queries de búsqueda).
   */
  createFingerprint(item: MercadoLibreItem): Promise<ProductFingerprint>;
  /**
   * Evalúa un candidato contra el producto fuente y devuelve un resultado
   * normalizado. Implementado en Fase 4 (matching).
   */
  matchCandidate(
    source: MercadoLibreItem,
    candidate: MercadoLibreItem,
    fingerprint: ProductFingerprint
  ): Promise<AIMatchResult>;
}

export type { ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
export type { AIMatchResult, MatchType } from "@/lib/ai/schemas/matching";