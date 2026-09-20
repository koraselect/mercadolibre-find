import { describe, expect, it } from "vitest";
import { parseMeliInput, buildItemUrl, normalizeRawId, inferSiteFromHost } from "@/lib/ml/urls";

describe("parseMeliInput", () => {
  it("parsea id crudo sin guion", () => {
    const r = parseMeliInput("MLV1024764940");
    expect(r).toEqual({
      siteId: "MLV",
      numericId: "1024764940",
      rawId: "MLV1024764940",
      kind: "item",
    });
  });

  it("parsea id crudo con guion", () => {
    const r = parseMeliInput("MLV-1024764940");
    expect(r?.numericId).toBe("1024764940");
    expect(r?.rawId).toBe("MLV1024764940");
  });

  it("parsea URL de articulo real", () => {
    const url =
      "https://articulo.mercadolibre.com.ve/MLV-1024764940-cable-n-12-thw-awg-pvc-100-cobre-600v-75c-x-10mts-_JM#reco_item_pos=0";
    const r = parseMeliInput(url);
    expect(r?.siteId).toBe("MLV");
    expect(r?.numericId).toBe("1024764940");
    expect(r?.kind).toBe("item");
  });

  it("parsea URL de producto de catalogo /p/", () => {
    const r = parseMeliInput("https://www.mercadolibre.com.ve/p/MLV14083215");
    expect(r?.numericId).toBe("14083215");
    expect(r?.kind).toBe("product");
  });

  it("resuelve host del sitio", () => {
    expect(inferSiteFromHost("articulo.mercadolibre.com.ve")).toBe("MLV");
    expect(inferSiteFromHost("articulo.mercadolibre.cl")).toBe("MLC");
  });

  it("rechaza inputs no-ML", () => {
    expect(parseMeliInput("https://google.com/producto")).toBeNull();
    expect(parseMeliInput("")).toBeNull();
    expect(parseMeliInput("  ")).toBeNull();
    expect(parseMeliInput("https://github.com/MLV-123")).toBeNull();
  });

  it("rechaza ids malformados", () => {
    expect(parseMeliInput("MLX123")).toBeNull();
  });
});

describe("buildItemUrl", () => {
  it("construye url canónica", () => {
    const id = parseMeliInput("MLV1024764940");
    expect(buildItemUrl(id!)).toContain("MLV1024764940");
  });
});

describe("normalizeRawId", () => {
  it("mayuscula y sin guiones", () => {
    expect(normalizeRawId("mlv-1024764940")).toBe("MLV1024764940");
  });
});