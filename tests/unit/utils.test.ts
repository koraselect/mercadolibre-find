import { describe, expect, it } from "vitest";
import { similarityTokens, similarityBigram, tokenize, slugify, normalizeText, truncate } from "@/lib/utils/text";
import { clamp, round, percentChange, safeDivide, formatPercent } from "@/lib/utils/numbers";
import { formatCurrency } from "@/lib/utils/currency";
import { sanitizeFields } from "@/lib/logging/logger";

describe("text utils", () => {
  it("normaliza minúsculas y acentos", () => {
    expect(normalizeText("Mini Aspiradora Portátil ÁÉÍ")).toBe("mini aspiradora portatil aei");
  });

  it("tokeniza excluyendo stopwords", () => {
    expect(tokenize("aspiraDora de mano USB 120W")).toEqual(["aspiradora", "mano", "usb", "120w"]);
  });

  it("similitud token: iguales = 1, distintas = >0 baja", () => {
    expect(similarityTokens("mini aspiradora portatil usb", "mini aspiradora portatil usb")).toBe(1);
    const cross = similarityTokens("mini aspiradora portatil usb", "cafetera programable 6 tazas");
    expect(cross).toBeLessThan(0.5);
  });

  it("similitud bigrama detecta similitud parcial", () => {
    expect(similarityBigram("Samsung Galaxy A15", "Samsung Galaxy A15 5G")).toBeGreaterThan(0.6);
  });

  it("slugify y truncate", () => {
    expect(slugify("Mini Aspiradora Portátil")).toBe("mini-aspiradora-portatil");
    expect(truncate("1234567890", 5)).toBe("12345…");
    expect(truncate("corto", 10)).toBe("corto");
  });
});

describe("numbers utils", () => {
  it("clamp/round", () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(round(1.2345, 2)).toBe(1.23);
  });
  it("percentChange y safeDivide", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(safeDivide(10, 0)).toBe(0);
  });
  it("formatPercent", () => {
    expect(formatPercent(0.1)).toBe("10%");
    expect(formatPercent(0.1234, 1)).toBe("12.3%");
  });
});

describe("currency", () => {
  it("formatea VES y USD", () => {
    expect(formatCurrency(1234.5, "VES")).toContain("1.234,50");
    expect(formatCurrency(1234.5, "USD")).toContain("$");
    expect(formatCurrency(Number.NaN)).toBe("—");
  });
});

describe("logging sanitize", () => {
  it("censura secretos y deja el resto", () => {
    const out = sanitizeFields({ apiKey: "abc", provider: "gemini", token: "x" });
    expect(out?.apiKey).toBe("[REDACTED]");
    expect(out?.token).toBe("[REDACTED]");
    expect(out?.provider).toBe("gemini");
  });
});