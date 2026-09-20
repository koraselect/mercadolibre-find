import type { MercadoLibreItemId, MercadoLibreItem, MercadoLibreVariation } from "@/lib/ml/types";
import { itemRawSchema, itemVariationsSchema, itemDescriptionSchema, catalogProductSchema } from "@/lib/ml/types";
import type { MeliHttpClient } from "@/lib/ml/client";
import { buildItemUrl } from "@/lib/ml/urls";
import { logger } from "@/lib/logging/logger";

/**
 * Ensambla un `MercadoLibreItem` normalizado desde las fuentes disponibles:
 * - Con token de usuario: GET /items/{id} (datos completos).
 * - Sin él (app token): variaciones (precio) + descripción (públicas).
 * - El catálogo (products/{id}) se usa como apoyo de atributos si el ítem
 *   pertenece a un catálogo y no se pudo leer el ítem completo.
 */
export async function fetchItem(itemId: MercadoLibreItemId, client: MeliHttpClient): Promise<MercadoLibreItem> {
  const id = itemId.siteId + itemId.numericId;
  const dataSources: MercadoLibreItem["dataSources"] = [];
  const base: MercadoLibreItem = {
    id: itemId,
    title: null,
    price: null,
    currency: null,
    status: null,
    subStatus: null,
    availableQuantity: null,
    stockBucket: { range: null, minEstimate: null },
    seller: { id: null, nickname: null },
    pictures: [],
    description: null,
    domainId: null,
    categoryId: null,
    catalogProductId: null,
    attributes: {},
    variations: [],
    permalink: buildItemUrl(itemId),
    dataSources,
    fetchedAt: new Date().toISOString(),
  };

  // 1) Intento de ítem completo (solo posible con token de usuario).
  try {
    const { data } = await client.get<unknown>(`/items/${id}`, { retryPublic: true });
    const item = itemRawSchema.safeParse(data);
    if (item.success) {
      dataSources.push("item");
      applyItemRaw(base, item.data);
    }
  } catch (err) {
    // 403/404 se tolera: se continúa con variaciones+descripción.
    logger.debug("meli.item_full_unavailable", { id, cause: String(err).slice(0, 120) });
  }

  // 2) Variaciones (da precio aunque el ítem esté restringido).
  try {
    const { data } = await client.get<unknown>(`/items/${id}/variations`);
    const variations = itemVariationsSchema.safeParse(data);
    if (variations.success && variations.data.length > 0) {
      dataSources.push("variations");
      base.variations = variations.data.map((v): MercadoLibreVariation => ({
        id: String(v.id),
        price: v.price ?? 0,
        attributes: attributeMap(v.attribute_combinations),
        pictureIds: v.picture_ids ?? [],
      }));
      if (base.price === null) {
        const min = Math.min(...base.variations.map((v) => v.price));
        base.price = Number.isFinite(min) ? min : base.variations[0].price;
      }
      for (const v of variations.data) {
        if (Array.isArray(v.picture_ids)) {
          for (const pic of v.picture_ids) {
            if (!base.pictures.includes(pic)) base.pictures.push(pic);
          }
        }
        if (typeof v.available_quantity === "number" && base.availableQuantity === null) {
          base.availableQuantity = v.available_quantity;
        }
        if (v.catalog_product_id && !base.catalogProductId) base.catalogProductId = v.catalog_product_id;
      }
    }
  } catch (err) {
    logger.debug("meli.variations_unavailable", { id, cause: String(err).slice(0, 120) });
  }

  // 3) Descripción (pública).
  try {
    const { data } = await client.get<unknown>(`/items/${id}/description`);
    const desc = itemDescriptionSchema.safeParse(data);
    if (desc.success) {
      dataSources.push("description");
      base.description = (desc.data.plain_text ?? desc.data.text ?? null)?.slice(0, 4000) ?? null;
    }
  } catch (err) {
    logger.debug("meli.description_unavailable", { id, cause: String(err).slice(0, 120) });
  }

  // 4) Catálogo como relleno de atributos si el ítem pertenece a uno.
  if (base.catalogProductId) {
    try {
      const prodId = base.catalogProductId;
      const { data } = await client.get<unknown>(`/products/${prodId}?site_id=${itemId.siteId}`);
      const product = catalogProductSchema.safeParse(data);
      if (product.success) {
        dataSources.push("catalog");
        if (base.title === null) base.title = product.data.name ?? null;
        base.domainId = product.data.domain_id ?? null;
        base.categoryId = product.data.category_id ?? null;
        if (product.data.pictures) {
          for (const pic of product.data.pictures) if (!base.pictures.includes(pic)) base.pictures.push(pic);
        }
        base.attributes = { ...base.attributes, ...attributeMap(product.data.attributes) };
        if (product.data.buy_box_winner) {
          const w = product.data.buy_box_winner;
          if (base.price === null) base.price = w.price ?? null;
          if (base.currency === null) base.currency = w.currency_id ?? null;
          if (typeof w.available_quantity === "number" && base.availableQuantity === null) {
            base.availableQuantity = w.available_quantity;
          }
          if (w.item_id && base.catalogProductId === null) base.catalogProductId = null;
        }
      }
    } catch (err) {
      logger.debug("meli.catalog_unavailable", { id, cause: String(err).slice(0, 120) });
    }
  }

  // El bucket de stock queda en null: el rango "referencial" solo se obtiene
  // de APIs que requieren token de usuario; aquí solo tenemos cantidad exacta.
  return base;
}

function applyItemRaw(base: MercadoLibreItem, raw: {
  title?: string | null; price?: number | null; currency_id?: string | null;
  status?: string | null; sub_status?: string | null; available_quantity?: number | null;
  seller_id?: number | string | null; permalink?: string | null; catalog_product_id?: string | null;
  category_id?: string | null; domain_id?: string | null; thumbnail?: string | null;
  pictures?: Array<{ id?: string | null; url?: string | null; secure_url?: string | null }> | null;
  attributes?: Array<{ id: string; value_name?: string | null; value_id?: string | null }> | null;
}): void {
  base.title = raw.title ?? base.title;
  base.price = raw.price ?? base.price;
  base.currency = raw.currency_id ?? base.currency;
  base.status = (raw.status as MercadoLibreItem["status"]) ?? base.status;
  base.subStatus = (raw.sub_status as MercadoLibreItem["subStatus"]) ?? base.subStatus;
  base.availableQuantity = raw.available_quantity ?? base.availableQuantity;
  base.seller.id = raw.seller_id !== undefined && raw.seller_id !== null ? String(raw.seller_id) : base.seller.id;
  base.permalink = raw.permalink ?? base.permalink;
  base.catalogProductId = raw.catalog_product_id ?? base.catalogProductId;
  base.categoryId = raw.category_id ?? base.categoryId;
  base.domainId = raw.domain_id ?? base.domainId;
  if (Array.isArray(raw.pictures)) {
    for (const p of raw.pictures) {
      const u = p?.secure_url ?? p?.url;
      if (u && !base.pictures.includes(u)) base.pictures.push(u);
    }
  }
  if (Array.isArray(raw.attributes)) {
    base.attributes = { ...base.attributes, ...attributeMap(raw.attributes) };
  }
  if (raw.available_quantity === 0) {
    base.subStatus = "out_of_stock";
  }
}

function attributeMap(
  attrs?: Array<{ id?: string | null; value_name?: string | null; value_id?: string | null }> | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of attrs ?? []) {
    if (a?.id && a.value_name != null) out[a.id] = a.value_name;
  }
  return out;
}