import { describe, expect, it } from "vitest";
import { parseMeliInput } from "@/lib/ml/urls";
import { loadFixtureItem } from "@/lib/ml/fixture-client";

const REAL_ITEM = "MLV1024764940";

describe("fixture client", () => {
  it("carga variaciones y descripción del fixture real", async () => {
    const itemId = parseMeliInput(REAL_ITEM)!;
    const item = await loadFixtureItem(itemId);
    expect(item.id.rawId).toBe(REAL_ITEM);
    expect(item.variations.length).toBeGreaterThan(0);
    expect(item.variations[0].price).toBeGreaterThan(0);
    expect(item.description).toBeTruthy();
    expect(item.pictures.length).toBeGreaterThan(0);
    expect(item.dataSources).toContain("fixture");
  });
});