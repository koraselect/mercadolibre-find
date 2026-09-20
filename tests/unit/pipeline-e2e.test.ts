import { describe, expect, it } from "vitest";
import { makeItem } from "../helpers/make-item";
import { buildProductDigest } from "@/lib/analysis/normalize";
import { buildFallbackSearchQueries } from "@/lib/analysis/search-queries";
import { findCheaperAlternatives } from "@/lib/analysis/opportunity";
import { preScoreCandidate, rankCandidatesForAI } from "@/lib/analysis/pre-score";
import { calculateProfitability, DEFAULT_FEE_PROFILE } from "@/lib/analysis/profitability";
import { classifyOpportunity } from "@/lib/analysis/classification";
import { assessRisk } from "@/lib/analysis/risk";

describe("Pipeline end-to-end", () => {
  const source = makeItem({
    id: { rawId: "MLV100", siteId: "MLV", numericId: "100", kind: "item" },
    title: "iPhone 14 128GB Nuevo",
    price: 500,
    currency: "USD",
    attributes: { BRAND: "APPLE", MODEL: "iPhone 14", MPN: "IPH14-128" },
  });

  const candidate = makeItem({
    id: { rawId: "MLV200", siteId: "MLV", numericId: "200", kind: "item" },
    title: "Apple iPhone 14 128GB Nuevo Cerrado",
    price: 420,
    currency: "USD",
    attributes: { BRAND: "APPLE", MODEL: "iPhone 14", MPN: "IPH14-128" },
  });

  const expensiveCandidate = makeItem({
    id: { rawId: "MLV300", siteId: "MLV", numericId: "300", kind: "item" },
    title: "iPhone 14 128GB",
    price: 550,
    currency: "USD",
    attributes: { BRAND: "APPLE", MODEL: "iPhone 14", MPN: "IPH14-128" },
  });

  it("paso 1: digest del source", () => {
    const digest = buildProductDigest(source);
    expect(digest.brand).toBe("APPLE");
    expect(digest.model).toBe("iPhone 14");
    expect(digest.mpn).toBe("IPH14-128");
    expect(digest.price).toBe(500);
  });

  it("paso 2: genera queries de busqueda", () => {
    const digest = buildProductDigest(source);
    const queries = buildFallbackSearchQueries({
      title: digest.title,
      brand: digest.brand,
      model: digest.model,
    });
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.some((q) => q.toLowerCase().includes("iphone"))).toBe(true);
  });

  it("paso 3: encuentra alternativas mas baratas", () => {
    const result = findCheaperAlternatives(source, [candidate, expensiveCandidate]);
    expect(result.alternatives.length).toBe(1);
    expect(result.alternatives[0].itemId).toBe("MLV200");
    expect(result.alternatives[0].savings).toBe(80);
    expect(result.alternatives[0].savingsPct).toBeCloseTo(0.16, 1);
  });

  it("paso 4: pre-score rankea candidatos", () => {
    const scored = preScoreCandidate(source, candidate);
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.breakdown.brandMatch).toBe(1);
    expect(scored.breakdown.modelMatch).toBe(1);
    expect(scored.breakdown.priceAdvantage).toBeGreaterThan(0);
  });

  it("paso 4b: rankCandidatesForAI limita candidatos", () => {
    const candidates = [candidate, expensiveCandidate];
    const top = rankCandidatesForAI(source, candidates, 1);
    expect(top.length).toBe(1);
    expect(top[0].item.id?.rawId).toBe("MLV200");
  });

  it("paso 5: calcula rentabilidad", () => {
    const profit = calculateProfitability({
      salePrice: 500,
      acquisitionPrice: 420,
      fees: DEFAULT_FEE_PROFILE,
    });
    expect(profit.estimatedProfit).toBeGreaterThan(0);
    expect(profit.marginPercent).toBeGreaterThan(0);
    expect(profit.roiPercent).toBeGreaterThan(0);
  });

  it("paso 6: clasifica oportunidad", () => {
    const profit = calculateProfitability({
      salePrice: 500,
      acquisitionPrice: 350,
      fees: { marketplaceFeePct: 0.05 },
    });
    const classification = classifyOpportunity({
      match: {
        candidateId: "MLV200",
        sameProduct: true,
        matchType: "exact",
        confidence: 0.95,
        score: 0.9,
        matchedAttributes: ["brand", "model", "mpn"],
        differences: [],
        missingInformation: [],
        risks: [],
        explanation: "Mismo producto",
      },
      profitability: profit,
    });
    expect(["HIGH", "MEDIUM"]).toContain(classification.level);
  });

  it("paso 7: evalua riesgos", () => {
    const match = {
      candidateId: "MLV200",
      sameProduct: true,
      matchType: "exact" as const,
      confidence: 0.95,
      score: 0.9,
      matchedAttributes: [],
      differences: [],
      missingInformation: [],
      risks: [],
      explanation: "OK",
    };
    const risk = assessRisk({ source, candidate, match });
    expect(["low", "medium"]).toContain(risk.level);
  });
});
