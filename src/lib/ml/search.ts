import type { MeliHttpClient } from "@/lib/ml/client";
import type { MercadoLibreItem, MercadoLibreItemId } from "@/lib/ml/types";
import { legacySearchSchema, productSearchSchema } from "@/lib/ml/types";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { buildItemUrl } from "@/lib/ml/urls";

export interface SearchOptions {
  site?: string;
  limit?: number;
}

/**
 * Búsqueda de candidatos. Con token de usuario usa la búsqueda de ítems
 * (datos reales de precio/stock). Sin él, cae al catálogo de productos
 * (sin precio) para alimentar el pipeline de matching determinístico.
 */
export async function searchCandidates(
  client: MeliHttpClient,
  query: string,
  opts: SearchOptions = {}
): Promise<MercadoLibreItem[]> {
  const site = opts.site ?? "MLV";
  const limit = Math.min(opts.limit ?? 10, 30);

  // 1) Búsqueda legacy (solo con token de usuario).
  try {
    const { data } = await client.get<unknown>(
      `/sites/${site}/search?q=${encodeURIComponent(query)}&limit=${limit}&status=active`
    );
    const parsed = legacySearchSchema.safeParse(data);
    if (parsed.success && parsed.data.results.length > 0) {
      logger.info("meli.search.legacy_ok", { site, q: query, n: parsed.data.results.length });
      return parsed.data.results.map((r) => legacyToItem(r, site));
    }
  } catch (err) {
    logger.debug("meli.search.legacy_failed", { site, q: query, cause: String(err).slice(0, 160) });
  }

  // 2) Fallback: catálogo de productos (público con app token).
  try {
    const { data } = await client.get<unknown>(
      `/products/search?site_id=${site}&q=${encodeURIComponent(query)}&limit=${limit}`
    );
    const parsed = productSearchSchema.safeParse(data);
    if (parsed.success && parsed.data.results.length > 0) {
      logger.info("meli.search.catalog_ok", { site, q: query, n: parsed.data.results.length });
      return parsed.data.results.map((r) => catalogToItem(r, site));
    }
  } catch (err) {
    const cause = String(err).slice(0, 160);
    logger.debug("meli.search.catalog_failed", { site, q: query, cause });
  }

  throw new AppError(
    "SEARCH_EMPTY",
    "No encontramos productos para esa búsqueda. Intenta con otras palabras o conecta tu cuenta de MercadoLibre para más resultados."
  );
}

function legacyToItem(r: {
  id: string; title?: string | null; price?: number | null; currency_id?: string | null;
  status?: string | null; sub_status?: string | null; available_quantity?: number | null;
  permalink?: string | null; thumbnail?: string | null;
  seller?: { id?: number | null; nickname?: string | null } | null;
  catalog_product_id?: string | null;
}, site: string): MercadoLibreItem {
  const rawId = r.id.toUpperCase();
  const itemId: MercadoLibreItemId = {
    siteId: (rawId.match(/^([A-Z]{3})/) ?? [null, site])[1],
    numericId: rawId.replace(/^[A-Z]{3}/, ""),
    rawId,
    kind: "item",
  };
  return {
    id: itemId,
    title: r.title ?? null,
    price: r.price ?? null,
    currency: r.currency_id ?? null,
    status: (r.status as MercadoLibreItem["status"]) ?? null,
    subStatus: (r.sub_status as MercadoLibreItem["subStatus"]) ?? null,
    availableQuantity: r.available_quantity ?? null,
    stockBucket: { range: null, minEstimate: null },
    seller: { id: r.seller?.id != null ? String(r.seller.id) : null, nickname: r.seller?.nickname ?? null },
    pictures: r.thumbnail ? [r.thumbnail] : [],
    description: null,
    domainId: null,
    categoryId: null,
    catalogProductId: r.catalog_product_id ?? null,
    attributes: {},
    variations: [],
    permalink: r.permalink ?? buildItemUrl(itemId),
    dataSources: ["search"],
    fetchedAt: new Date().toISOString(),
  };
}

function catalogToItem(r: {
  id: string; name?: string | null; status?: string | null; children_ids?: string[] | null;
  pictures?: string[] | null; domain_id?: string | null; category_id?: string | null;
  catalog_product_id?: string | null;
}, site: string): MercadoLibreItem {
  const rawId = r.id.toUpperCase();
  const itemId: MercadoLibreItemId = {
    siteId: (rawId.match(/^([A-Z]{3})/) ?? [null, site])[1],
    numericId: rawId.replace(/^[A-Z]{3}/, ""),
    rawId,
    kind: "product",
  };
  return {
    id: itemId,
    title: r.name ?? null,
    price: null,
    currency: null,
    status: null,
    subStatus: null,
    availableQuantity: null,
    stockBucket: { range: null, minEstimate: null },
    seller: { id: null, nickname: null },
    pictures: r.pictures ?? [],
    description: null,
    domainId: r.domain_id ?? null,
    categoryId: r.category_id ?? null,
    catalogProductId: r.catalog_product_id ?? null,
    attributes: {},
    variations: [],
    permalink: buildItemUrl(itemId),
    dataSources: ["catalog"],
    fetchedAt: new Date().toISOString(),
  };
}