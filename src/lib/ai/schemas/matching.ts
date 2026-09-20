import { z } from "zod";

/**
 * Schema Zod de matching candidato (TODO §19, §42).
 * Es la salida normalizada de Gemini cuando evalúa "¿este candidato es el
 * mismo producto que el fingerprint?"; se usa como filtro y como score.
 */

export const MATCH_TYPES = ["exact", "same_model", "equivalent", "similar", "not_match"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const matchResultSchema = z
  .object({
    candidateId: z.string().min(1).max(80),
    sameProduct: z.boolean(),
    matchType: z.enum(MATCH_TYPES),
    confidence: z.coerce.number().min(0).max(1),
    score: z.coerce.number().min(0).max(1),
    matchedAttributes: z.array(z.string().min(1).max(160)).max(40).default([]),
    differences: z.array(z.string().min(1).max(160)).max(40).default([]),
    missingInformation: z.array(z.string().min(1).max(160)).max(40).default([]),
    risks: z.array(z.string().min(1).max(160)).max(40).default([]),
    explanation: z.string().min(1).max(600),
  })
  .strict();

export type AIMatchResult = z.infer<typeof matchResultSchema>;

/** Descripción del esquema para incluir en prompts (fuente única de verdad). */
export const MATCH_SCHEMA_DOC = `{
  "candidateId": string,
  "sameProduct": boolean,
  "matchType": "exact" | "same_model" | "equivalent" | "similar" | "not_match",
  "confidence": number,           // 0 a 1, cuánto cree el modelo que es el mismo
  "score": number,                // 0 a 1, calidad/pertinencia del match
  "matchedAttributes": string[],  // atributos que coinciden
  "differences": string[],        // diferencias encontradas
  "missingInformation": string[], // datos que faltan para confirmar
  "risks": string[],              // riesgos detectados
  "explanation": string
}`;
