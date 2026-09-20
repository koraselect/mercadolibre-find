import { describe, expect, it } from "vitest";
import { matchResultSchema } from "@/lib/ai/schemas/matching";

const valid = {
  candidateId: "MLV999",
  sameProduct: true,
  matchType: "same_model",
  confidence: 0.9,
  score: 0.88,
  matchedAttributes: ["brand", "model"],
  differences: ["color"],
  missingInformation: [],
  risks: ["vendedor sin historial"],
  explanation: "Mismo modelo, cambia el color.",
};

describe("matchResultSchema", () => {
  it("acepta un resultado válido", () => {
    expect(matchResultSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza score fuera de rango", () => {
    const r = matchResultSchema.safeParse({ ...valid, score: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rechaza matchType inválido", () => {
    const r = matchResultSchema.safeParse({ ...valid, matchType: "perfect" });
    expect(r.success).toBe(false);
  });

  it("rechaza campos extra (strict)", () => {
    const r = matchResultSchema.safeParse({ ...valid, foo: "bar" });
    expect(r.success).toBe(false);
  });

  it("aplica defaults a los arreglos ausentes", () => {
    const r = matchResultSchema.safeParse({
      candidateId: "MLV999",
      sameProduct: false,
      matchType: "not_match",
      confidence: 0.2,
      score: 0.1,
      explanation: "No coincide.",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.risks).toEqual([]);
  });
});