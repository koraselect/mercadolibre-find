import { z } from "zod";

/**
 * Tipos del dominio MercadoLibre y esquemas Zod de las fronteras con la API.
 * Los schemas de payload son tolerantes (campos opcionales) para resistir
 * cambios de la API y se validan en cada lectura externa.
 */

export const SITE_IDS = ["MLV", "MLA", "MLB", "MLM", "MLC", "MCO", "MPE", "MLU", "MEC"] as const;
export type MercadoLibreSite = (typeof SITE_IDS)[number];

/** Id normalizado de un ítem: sitio + número + id crudo. */
export interface MercadoLibreItemId {
  siteId: MercadoLibreSite | string;
  numericId: string;
  rawId: string;
  /** true si el id viene de un ítem (articulo) y no de un producto de catálogo */
  kind: "item" | "product";
}

/** Estados observables de un ítem (ver clasificación en docs de ML). */
export const ITEM_STATUS = [
  "active",
  "paused",
  "closed",
  "under_review",
  "not_yet_active",
  "cancelled",
] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];

export const ITEM_SUB_STATUS = [
  "out_of_stock",
  "suspended",
  "deleted",
  "freezed",
  "accidental_listing",
  "not_available",
  null,
] as const;
export type ItemSubStatus = (typeof ITEM_SUB_STATUS)[number];

/** Rangos de stock "referencial" que devuelve ML para stock de terceros. */
export const STOCK_RANGES = [
  "RANGO_1_50",
  "RANGO_51_100",
  "RANGO_101_200",
  "RANGO_201_500",
  "RANGO_501_1000",
  "RANGO_1001_5000",
  "RANGO_5001_10000",
  "RANGO_10001_1000000",
] as const;
export type StockRange = (typeof STOCK_RANGES)[number];

export interface StockBucket {
  range: StockRange | null;
  /** estimación conservadora mínima del rango */
  minEstimate: number | null;
}

/** Método con el que se obtuvo el dato (para transparencia en la UI). */
export type DataSource = "item" | "variations" | "description" | "catalog" | "search" | "fixture";

/** Item normalizado interno, agnóstico de la fuente. */
export interface MercadoLibreItem {
  id: MercadoLibreItemId;
  title: string | null;
  /** Precio del ítem (mayor consumo). Con app token solo disponible via variations. */
  price: number | null;
  currency: string | null;
  status: ItemStatus | null;
  subStatus: ItemSubStatus | null;
  /** stock exacto (con token de usuario) o null (no disponible con app token). */
  availableQuantity: number | null;
  stockBucket: StockBucket;
  seller: { id: string | null; nickname: string | null };
  pictures: string[];
  description: string | null;
  domainId: string | null;
  categoryId: string | null;
  catalogProductId: string | null;
  attributes: Record<string, string>;
  variations: MercadoLibreVariation[];
  permalink: string | null;
  /** fuentes de datos que contribuyeron a este item */
  dataSources: DataSource[];
  fetchedAt: string;
}

export interface MercadoLibreVariation {
  id: string;
  price: number;
  attributes: Record<string, string>;
  pictureIds: string[];
}

/* ------------------------------------------------------------------ */
/* Schemas Zod de payloads crudos (fronteras externas)                  */
/* ------------------------------------------------------------------ */

export const mLApiErrorSchema = z.object({
  message: z.string().nullish(),
  error: z.string().nullish(),
  status: z.number().nullish(),
  cause: z.unknown().nullish(),
});

export const appTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional().default(21600),
  scope: z.string().optional(),
  user_id: z.union([z.number(), z.string()]).optional(),
  refresh_token: z.string().optional(),
});

export type AppTokenPayload = z.infer<typeof appTokenSchema>;

/** GET /items/{id} — requiere token de usuario (con app token da 403). */
export const itemRawSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    price: z.number().nullish(),
    base_price: z.number().nullish(),
    currency_id: z.string().nullish(),
    status: z.string().nullish(),
    sub_status: z.string().nullish(),
    available_quantity: z.number().nullish(),
    seller_id: z.union([z.number(), z.string()]).nullish(),
    permalink: z.string().nullish(),
    catalog_product_id: z.string().nullish(),
    category_id: z.string().nullish(),
    domain_id: z.string().nullish(),
    thumbnail: z.string().nullish(),
    pictures: z
      .array(z.object({ id: z.string().nullish(), url: z.string().nullish(), secure_url: z.string().nullish() }))
      .nullish(),
    attributes: z
      .array(z.object({ id: z.string(), value_name: z.string().nullish(), value_id: z.string().nullish() }))
      .nullish(),
    variations: z
      .array(
        z.object({
          id: z.union([z.number(), z.string()]),
          price: z.number().nullish(),
          available_quantity: z.number().nullish(),
          attribute_combinations: z
            .array(z.object({ id: z.string().nullish(), value_name: z.string().nullish(), value_id: z.string().nullish() }))
            .nullish(),
          sale_terms: z.unknown().nullish(),
        })
      )
      .nullish(),
  })
  .passthrough();

export type ItemRaw = z.infer<typeof itemRawSchema>;

/** GET /items/{id}/variations — público incluso con app token. */
export const itemVariationsSchema = z.array(
  z.object({
    id: z.union([z.number(), z.string()]),
    price: z.number().nullish(),
    available_quantity: z.number().nullish(),
    catalog_product_id: z.string().nullish(),
    attribute_combinations: z
      .array(z.object({ id: z.string().nullish(), value_name: z.string().nullish(), value_id: z.string().nullish() }))
      .nullish(),
    picture_ids: z.array(z.string()).nullish(),
    sale_terms: z.unknown().nullish(),
  })
);

export type ItemVariationsRaw = z.infer<typeof itemVariationsSchema>;

/** GET /items/{id}/description — público. */
export const itemDescriptionSchema = z
  .object({
    plain_text: z.string().nullish(),
    text: z.string().nullish(),
    html: z.string().nullish(),
  })
  .passthrough();

export type ItemDescriptionRaw = z.infer<typeof itemDescriptionSchema>;

/** GET /products/{id} — público (catálogo). */
export const catalogProductSchema = z
  .object({
    id: z.string(),
    catalog_product_id: z.string().nullish(),
    status: z.string().nullish(),
    domain_id: z.string().nullish(),
    category_id: z.string().nullish(),
    name: z.string().nullish(),
    permalink: z.string().nullish(),
    buy_box_winner: z
      .object({
        item_id: z.string().nullish(),
        price: z.number().nullish(),
        currency_id: z.string().nullish(),
        seller_id: z.union([z.number(), z.string()]).nullish(),
        available_quantity: z.number().nullish(),
      })
      .nullish(),
    pictures: z.array(z.string()).nullish(),
    attributes: z
      .array(z.object({ id: z.string(), value_name: z.string().nullish(), value_id: z.string().nullish() }))
      .nullish(),
    children_ids: z.array(z.string()).nullish(),
  })
  .passthrough();

export type CatalogProductRaw = z.infer<typeof catalogProductSchema>;

/** GET /products/search — público (texto devuelve `name`, no `title`). */
export const productSearchSchema = z
  .object({
    results: z
      .array(
        z.object({
          id: z.string(),
          catalog_product_id: z.string().nullish(),
          domain_id: z.string().nullish(),
          category_id: z.string().nullish(),
          name: z.string().nullish(),
          status: z.string().nullish(),
          children_ids: z.array(z.string()).nullish(),
          pictures: z.array(z.string()).nullish(),
          attributes: z.array(z.object({ id: z.string(), value_name: z.string().nullish() })).nullish(),
        })
      )
      .default([]),
  })
  .passthrough();

export type ProductSearchRaw = z.infer<typeof productSearchSchema>;

/** GET /sites/{site}/search (legacy) — requiere token de usuario. */
export const legacySearchSchema = z
  .object({
    results: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().nullish(),
          price: z.number().nullish(),
          currency_id: z.string().nullish(),
          status: z.string().nullish(),
          sub_status: z.string().nullish(),
          available_quantity: z.number().nullish(),
          permalink: z.string().nullish(),
          thumbnail: z.string().nullish(),
          seller: z.object({ id: z.number().nullish(), nickname: z.string().nullish() }).nullish(),
          catalog_product_id: z.string().nullish(),
        })
      )
      .default([]),
  })
  .passthrough();

export type LegacySearchRaw = z.infer<typeof legacySearchSchema>;

/* ------------------------------------------------------------------ */
/* Helpers de estado/stock                                              */
/* ------------------------------------------------------------------ */

export const WITHOUT_STOCK_LABEL = "paused";

/** Mapea un label/rango de stock ML a bucket estimado. */
export function parseStockRange(value: string | null | undefined): StockRange | null {
  if (!value) return null;
  const v = value.toUpperCase();
  return (STOCK_RANGES as readonly string[]).includes(v) ? (v as StockRange) : null;
}

export function stockRangeMin(range: StockRange | null): number | null {
  if (!range) return null;
  const n = /RANGO_(\d+)/.exec(range)?.[1];
  return n ? Number(n) : null;
}

export function stockRangeMax(range: StockRange | null): number | null {
  if (!range) return null;
  const m = /RANGO_\d+_(\d+)/.exec(range)?.[1];
  return m ? Number(m) : null;
}

/** Si el ítem está sin stock (pausado sin stock / agotado). */
export function isOutOfStock(status?: string | null, subStatus?: string | null, availableQty?: number | null): boolean {
  if (typeof availableQty === "number") return availableQty <= 0;
  if (subStatus === "out_of_stock") return true;
  if (status === "paused") return true;
  if (status === "closed" && subStatus === "not_available") return true;
  return false;
}