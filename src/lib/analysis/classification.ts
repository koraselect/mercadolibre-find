import type { AIMatchResult } from "@/lib/ai/schemas/matching";
import type { ProfitabilityResult } from "@/lib/analysis/profitability";

/**
 * Clasificación de oportunidades (TODO §20).
 * Determina el nivel de confianza de una oportunidad basándose
 * en match score y rentabilidad.
 */

export const OPPORTUNITY_LEVELS = ["HIGH", "MEDIUM", "REVIEW", "REJECT"] as const;
export type OpportunityLevel = (typeof OPPORTUNITY_LEVELS)[number];

export interface ClassificationInput {
  match: AIMatchResult;
  profitability: ProfitabilityResult;
  /** Margen mínimo para HIGH (default 15%). */
  highMarginThreshold?: number;
  /** Margen mínimo para MEDIUM (default 5%). */
  mediumMarginThreshold?: number;
}

export interface ClassificationResult {
  level: OpportunityLevel;
  reasons: string[];
}

/**
 * Clasifica una oportunidad según match + rentabilidad.
 */
export function classifyOpportunity(input: ClassificationInput): ClassificationResult {
  const { match, profitability } = input;
  const highThreshold = input.highMarginThreshold ?? 15;
  const mediumThreshold = input.mediumMarginThreshold ?? 5;
  const reasons: string[] = [];

  if (!match.sameProduct) {
    reasons.push("AI determinó que NO es el mismo producto");
    return { level: "REJECT", reasons };
  }

  if (match.confidence < 0.7) {
    reasons.push(`Confianza AI baja: ${(match.confidence * 100).toFixed(0)}%`);
    return { level: "REJECT", reasons };
  }

  if (profitability.estimatedProfit <= 0) {
    reasons.push("No hay ganancia estimada");
    return { level: "REJECT", reasons };
  }

  if (match.confidence >= 0.9 && profitability.marginPercent >= highThreshold) {
    reasons.push(`Match alto: ${(match.confidence * 100).toFixed(0)}%`);
    reasons.push(`Margen fuerte: ${profitability.marginPercent.toFixed(1)}%`);
    return { level: "HIGH", reasons };
  }

  if (match.confidence >= 0.8 && profitability.marginPercent >= mediumThreshold) {
    reasons.push(`Match bueno: ${(match.confidence * 100).toFixed(0)}%`);
    reasons.push(`Margen aceptable: ${profitability.marginPercent.toFixed(1)}%`);
    return { level: "MEDIUM", reasons };
  }

  reasons.push(`Match: ${(match.confidence * 100).toFixed(0)}%, Margen: ${profitability.marginPercent.toFixed(1)}%`);
  reasons.push("Requiere verificación manual");
  return { level: "REVIEW", reasons };
}
