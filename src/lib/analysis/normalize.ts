import type { MercadoLibreItem } from "@/lib/ml/types";

/**
 * Normalización de un ítem ML a un digest determinístico (TODO §22, §45).
 * Es la Fase 1 del análisis: NO depende de la IA. Produce datos estables
 * (marca, modelo, MPN, atributos) que alimentan fingerprints y búsquedas.
 */

export interface ProductDigest {
  itemId: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  attributes: Record<string, string>;
  description: string | null;
}

export const MAX_DIGEST_DESCRIPTION_LEN = 900;

const BRAND_KEYS = new Set(["BRAND", "MARCA"]);
const MODEL_KEYS = new Set(["MODEL", "MODELO"]);
const MPN_KEYS = new Set(["MPN", "MODELO_FABRICANTE", "MODEL_NUMBER", "GTIN", "EAN"]);

function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

function cleanValue(value: string): string | null {
  const v = value.trim();
  if (!v || v.length > 512) return null;
  return v;
}

/** Busca el primer atributo cuya clave (normalizada) esté en `keys`. */
export function findAttribute(
  attrs: Record<string, string>,
  keys: Set<string>
): string | null {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (keys.has(normalizeKey(key))) {
      const v = cleanValue(value);
      if (v) return v;
    }
  }
  return null;
}

/** Prioriza brand/model y limita la cantidad de atributos. */
export function pickAttributes(
  attrs: Record<string, string>,
  max: number
): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(attrs ?? {})) {
    const v = cleanValue(value);
    if (v) entries.push([key, v]);
  }
  const ordered = [...entries].sort(([a], [b]) => {
    const rank = (k: string) =>
      BRAND_KEYS.has(normalizeKey(k)) || MODEL_KEYS.has(normalizeKey(k)) ? 0 : 1;
    return rank(a) - rank(b);
  });
  const out: Record<string, string> = {};
  for (const [k, v] of ordered) {
    out[k] = v;
    if (Object.keys(out).length >= max) break;
  }
  return out;
}

/** Construye el digest desde un ítem ML normalizado. */
export function buildProductDigest(item: MercadoLibreItem): ProductDigest {
  const attrs = item.attributes ?? {};
  const description = item.description;
  return {
    itemId: item.id?.rawId ?? null,
    title: item.title ?? null,
    brand: findAttribute(attrs, BRAND_KEYS),
    model: findAttribute(attrs, MODEL_KEYS),
    mpn: findAttribute(attrs, MPN_KEYS),
    price: item.price ?? null,
    currency: item.currency ?? null,
    category: item.categoryId ?? null,
    attributes: pickAttributes(attrs, 30),
    description:
      description && description.length > MAX_DIGEST_DESCRIPTION_LEN
        ? `${description.slice(0, MAX_DIGEST_DESCRIPTION_LEN)}…`
        : description,
  };
}

/** Convierte un digest en un bloque de texto para prompts. */
export function digestToText(digest: ProductDigest): string {
  const lines: string[] = [];
  lines.push(`title: ${digest.title ?? "-"}`);
  lines.push(`brand: ${digest.brand ?? "-"}`);
  lines.push(`model: ${digest.model ?? "-"}`);
  lines.push(`mpn: ${digest.mpn ?? "-"}`);
  if (digest.category) lines.push(`category: ${digest.category}`);
  if (digest.price != null) lines.push(`price: ${digest.price} ${digest.currency ?? ""}`);
  for (const [k, v] of Object.entries(digest.attributes)) {
    lines.push(`attr.${k}: ${v}`);
  }
  if (digest.description) lines.push(`description: ${digest.description}`);
  return lines.join("\n");
}

/** Texto corto para fingerprints: identificadores canonizados. */
export function identifiersText(digest: ProductDigest): string {
  const parts = [digest.brand, digest.model, digest.mpn]
    .filter((v): v is string => typeof v === "string" && v.length <= 60);
  return parts.map((p) => p.toUpperCase().replace(/[^A-Z0-9._-]+/g, "-")).join(" | ");
}
