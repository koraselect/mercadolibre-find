import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { hasMeliCredentials } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
import type { MercadoLibreItem, MercadoLibreItemId } from "@/lib/ml/types";
import { parseMeliInput } from "@/lib/ml/urls";

/**
 * Cliente de demostración basado en fixtures locales.
 * Sustituye al HTTP client cuando no hay credenciales o para tests (TODO §11).
 * Los fixtures se capturan desde la API real (tests/fixtures/items/*).
 */

export function demoModeEnabled(): boolean {
  return process.env.ML_DEMO === "1" || process.env.ML_DEMO === "true";
}

export function fixtureBasePath(): string {
  return path.join(process.cwd(), "tests", "fixtures");
}

export function hasFixtureFor(input: string): MercadoLibreItemId | null {
  const parsed = parseMeliInput(input);
  if (!parsed) return null;
  const base = path.join(fixtureBasePath(), "items");
  const hasItem =
    existsSync(path.join(base, `${parsed.rawId}.item.json`)) ||
    existsSync(path.join(base, `${parsed.rawId}.variations.json`));
  return hasItem ? parsed : null;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function loadFixtureItem(itemId: MercadoLibreItemId): Promise<MercadoLibreItem> {
  const dir = path.join(fixtureBasePath(), "items");
  const variationsJson = readJson(path.join(dir, `${itemId.rawId}.variations.json`)) as Array<{
    id?: string | number; price?: number; available_quantity?: number;
    attribute_combinations?: Array<{ id?: string; value_name?: string | null }>;
    picture_ids?: string[];
  }> | null;
  const descriptionJson = readJson(path.join(dir, `${itemId.rawId}.description.json`)) as {
    plain_text?: string | null; text?: string | null;
  } | null;
  const itemJson = readJson(path.join(dir, `${itemId.rawId}.item.json`)) as {
    title?: string; price?: number; currency_id?: string; status?: string;
    sub_status?: string; available_quantity?: number; seller_id?: number | string;
    pictures?: Array<{ secure_url?: string; url?: string }>;
  } | null;

  const pictures = itemJson?.pictures?.map((p) => p.secure_url ?? p.url ?? "").filter(Boolean) ?? [];
  const variations = (variationsJson ?? []).map((v) => {
    const attrs: Record<string, string> = {};
    for (const a of v.attribute_combinations ?? []) if (a.id && a.value_name != null) attrs[a.id] = a.value_name;
    return {
      id: String(v.id),
      price: v.price ?? 0,
      attributes: attrs,
      pictureIds: v.picture_ids ?? [],
    };
  });
  for (const v of variations) for (const pic of v.pictureIds) if (!pictures.includes(pic)) pictures.push(pic);

  const price = itemJson?.price ?? (variations.length ? Math.min(...variations.map((v) => v.price)) : null);
  const available = itemJson?.available_quantity ?? null;

  return {
    id: itemId,
    title: itemJson?.title ?? null,
    price: price ?? null,
    currency: itemJson?.currency_id ?? null,
    status: (itemJson?.status as MercadoLibreItem["status"]) ?? null,
    subStatus: (itemJson?.sub_status as MercadoLibreItem["subStatus"]) ?? null,
    availableQuantity: available,
    stockBucket: { range: null, minEstimate: null },
    seller: {
      id: itemJson?.seller_id != null ? String(itemJson.seller_id) : null,
      nickname: null,
    },
    pictures,
    description: (descriptionJson?.plain_text ?? descriptionJson?.text ?? null)?.slice(0, 4000) ?? null,
    domainId: null,
    categoryId: null,
    catalogProductId: null,
    attributes: {},
    variations,
    permalink: `https://articulo.mercadolibre.com.ve/${itemId.rawId}-_JM`,
    dataSources: ["fixture"],
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadFixtureItemByInput(input: string): Promise<MercadoLibreItem> {
  const parsed = hasFixtureFor(input);
  if (!parsed) {
    throw new AppError("NO_FIXTURE", "No hay datos de demostración para ese producto.");
  }
  return loadFixtureItem(parsed);
}

export function fixtureAvailability(): boolean {
  return demoModeEnabled() || !hasMeliCredentials();
}