import type { MercadoLibreItem } from "@/lib/ml/types";
import type { AIMatchResult } from "@/lib/ai/schemas/matching";

export const RISK_FACTORS = [
  "PRICE",
  "PRODUCT_MATCH",
  "VARIANT",
  "SELLER",
  "STOCK",
  "SHIPPING",
  "DATA_QUALITY",
  "AI_DISAGREEMENT",
] as const;

export type RiskFactor = (typeof RISK_FACTORS)[number];

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  factors: RiskFactor[];
  details: string[];
}

export interface RiskInput {
  source: MercadoLibreItem;
  candidate: MercadoLibreItem;
  match: AIMatchResult;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const { source, candidate, match } = input;
  const factors: RiskFactor[] = [];
  const details: string[] = [];

  if (source.price && candidate.price) {
    const ratio = candidate.price / source.price;
    if (ratio < 0.5) {
      factors.push("PRICE");
      details.push("Precio sospechosamente bajo: " + Math.round(ratio * 100) + "% del original");
    }
  }

  if (match.matchType === "similar" || match.matchType === "not_match") {
    factors.push("PRODUCT_MATCH");
    details.push("AI clasifico como: " + match.matchType);
  }

  if (match.differences.length > 3) {
    factors.push("VARIANT");
    details.push(match.differences.length + " diferencias detectadas");
  }

  if (!candidate.seller?.id) {
    factors.push("SELLER");
    details.push("Vendedor sin ID verificable");
  }

  if (candidate.availableQuantity != null && candidate.availableQuantity <= 0) {
    factors.push("STOCK");
    details.push("Sin stock disponible");
  }

  if (!candidate.title || candidate.title.length < 10) {
    factors.push("DATA_QUALITY");
    details.push("Titulo del candidato incompleto");
  }

  if (match.confidence < 0.7) {
    factors.push("AI_DISAGREEMENT");
    details.push("Confianza AI: " + Math.round(match.confidence * 100) + "%");
  }

  let level: "low" | "medium" | "high";
  if (factors.length === 0) {
    level = "low";
  } else if (factors.length <= 2 && !factors.includes("PRODUCT_MATCH")) {
    level = "medium";
  } else {
    level = "high";
  }

  return { level, factors, details };
}
