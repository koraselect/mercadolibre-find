import { describe, expect, it } from "vitest";
import {
  buildProductDigest,
  findAttribute,
  pickAttributes,
  digestToText,
} from "@/lib/analysis/normalize";
import { makeItem } from "../helpers/make-item";

describe("buildProductDigest", () => {
  it("extrae brand, model y mpn de atributos ML", () => {
    const digest = buildProductDigest(makeItem());
    expect(digest.brand).toBe("VCUTE");
    expect(digest.model).toBe("VC-120");
    expect(digest.mpn).toBe("VC120-USB");
    expect(digest.itemId).toBe("MLV1024764940");
    expect(digest.price).toBe(35);
  });

  it("no inventa datos ausentes", () => {
    const digest = buildProductDigest(makeItem({ attributes: {}, title: null }));
    expect(digest.brand).toBeNull();
    expect(digest.model).toBeNull();
    expect(digest.mpn).toBeNull();
    expect(digest.title).toBeNull();
  });

  it("acorta la descripción larga", () => {
    const digest = buildProductDigest(makeItem({ description: "x".repeat(5000) }));
    expect((digest.description ?? "").length).toBeLessThan(1000);
  });
});

describe("digestToText", () => {
  it("genera texto de datos para el prompt", () => {
    const text = digestToText(buildProductDigest(makeItem()));
    expect(text).toContain("title:");
    expect(text).toContain("brand: VCUTE");
  });
});

describe("findAttribute", () => {
  it("encuentra por clave normalizada", () => {
    expect(findAttribute({ brand: "X" }, new Set(["BRAND", "MARCA"]))).toBe("X");
    expect(findAttribute({ "BRAND ": "X" }, new Set(["BRAND"]))).toBe("X");
  });

  it("ignora valores largos o vacíos", () => {
    expect(findAttribute({ BRAND: "" }, new Set(["BRAND"]))).toBeNull();
    expect(findAttribute({ BRAND: "a".repeat(600) }, new Set(["BRAND"]))).toBeNull();
  });
});

describe("pickAttributes", () => {
  it("prioriza brand/model y limita cantidad", () => {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < 60; i++) attrs[`ATTR_${i}`] = `value-${i}`;
    attrs.BRAND = "ACME";
    attrs.MODEL = "X1";
    const picked = pickAttributes(attrs, 10);
    expect(Object.keys(picked).length).toBeLessThanOrEqual(10);
    expect(picked.BRAND).toBe("ACME");
  });
});
