import { describe, expect, it } from "vitest";
import { fingerprintSchema } from "@/lib/ai/schemas/fingerprint";

const valid = {
  canonicalName: "Mini Aspiradora Portátil USB 120W VCUTE",
  productType: "aspiradora portátil",
  brand: "VCUTE",
  model: "VC-120",
  identifiers: ["VC120-USB"],
  category: "Hogar",
  keySpecifications: [
    { name: "POTENCIA", value: "120W", importance: "critical" },
    { name: "COLOR", value: "Azul", importance: "optional" },
  ],
  variants: [],
  searchQueries: ["aspiradora portátil usb 120w", "mini aspiradora recargable vcute"],
  mustMatch: ["potencia 120W"],
  acceptableDifferences: ["color"],
  disqualifiers: ["repuesto", "sin batería"],
};

describe("fingerprintSchema", () => {
  it("acepta un fingerprint válido", () => {
    const r = fingerprintSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("aplica defaults a los arreglos ausentes", () => {
    const r = fingerprintSchema.safeParse({
      canonicalName: "X",
      productType: "Y",
      searchQueries: ["zz"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.identifiers).toEqual([]);
      expect(r.data.keySpecifications).toEqual([]);
      expect(r.data.variants).toEqual([]);
      expect(r.data.mustMatch).toEqual([]);
    }
  });

  it("rechaza searchQueries vacío", () => {
    const r = fingerprintSchema.safeParse({ ...valid, searchQueries: [] });
    expect(r.success).toBe(false);
  });

  it("rechaza una importancia inválida", () => {
    const r = fingerprintSchema.safeParse({
      ...valid,
      keySpecifications: [
        { name: "POTENCIA", value: "120W", importance: "critica" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza campos extra (strict)", () => {
    const r = fingerprintSchema.safeParse({ ...valid, extra: 1 });
    expect(r.success).toBe(false);
  });

  it("tolera brand/model nulos", () => {
    const r = fingerprintSchema.safeParse({ ...valid, brand: null, model: null });
    expect(r.success).toBe(true);
  });
});
