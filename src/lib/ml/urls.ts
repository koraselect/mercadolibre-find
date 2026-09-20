import type { MercadoLibreItemId } from "@/lib/ml/types";
import { SITE_IDS } from "@/lib/ml/types";

export const ML_API_BASE = "https://api.mercadolibre.com";

const ITEM_ID_RE = /^([A-Z]{3})-?(\d+)$/i;

const PRODUCT_ID_RE = /^([A-Z]{3})(\d+)$/i;

function validSite(site: string): boolean {
  return (SITE_IDS as readonly string[]).includes(site.toUpperCase());
}

const MAIN_SITES: Record<string, string> = {
  ".com.ar": "MLA",
  ".com.br": "MLB",
  ".com.co": "MCO",
  ".com.mx": "MLM",
  ".com.ve": "MLV",
  ".cl": "MLC",
  ".com.ec": "MEC",
  ".com.pe": "MPE",
  ".com.uy": "MLU",
};

export const SITE_DOMAIN_ALIASES: Record<string, string> = {
  "articulo.mercadolibre.com.ve": "MLV",
  "mercadolibre.com.ve": "MLV",
  "listado.mercadolibre.com.ve": "MLV",
  "productos.mercadolibre.com.ve": "MLV",
  "articulo.mercadolibre.cl": "MLC",
  "articulo.mercadolibre.com.ar": "MLA",
};

/**
 * Extrae el id de un ítem/producto desde una URL de MercadoLibre
 * o un id crudo. Devuelve null si no corresponde a ML.
 */
export function parseMeliInput(input: string): MercadoLibreItemId | null {
  const value = input.trim();
  if (!value) return null;

  // Id crudo desnudo: MLV1024764940 o MLV-1024764940
  const bareItem = ITEM_ID_RE.exec(value);
  if (bareItem && /^\d+$/.test(bareItem[2])) {
    const site = bareItem[1].toUpperCase();
    if (!validSite(site)) return null;
    return {
      siteId: site,
      numericId: bareItem[2],
      rawId: `${site}${bareItem[2]}`,
      kind: "item",
    };
  }

  // Limpiar URL: quitar fragmentos (#...) y tracking params
  let cleanUrl = value;
  const hashIdx = cleanUrl.indexOf("#");
  if (hashIdx !== -1) cleanUrl = cleanUrl.slice(0, hashIdx);
  cleanUrl = cleanUrl.split("?")[0];

  // Intentar parsear URL
  let url: URL;
  try {
    url = new URL(cleanUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const siteId = inferSiteFromHost(host);
  if (!siteId) return null;

  // /MLV-1024764940-<slug>-_JM o /MLV1024764940-<slug> (ítem articulo)
  const itemSeg = url.pathname.match(/\/([A-Za-z]{3})-?(\d+)-/i);
  if (itemSeg && validSite(itemSeg[1])) {
    const site = itemSeg[1].toUpperCase();
    return {
      siteId: site,
      numericId: itemSeg[2],
      rawId: `${site}${itemSeg[2]}`,
      kind: "item",
    };
  }

  // /p/MLV1024764940 (producto de catálogo)
  if (url.pathname.includes("/p/")) {
    const prodMatch = PRODUCT_ID_RE.exec(url.pathname.replace(/^\/p\//, ""));
    if (prodMatch && validSite(prodMatch[1])) {
      const site = prodMatch[1].toUpperCase();
      return {
        siteId: site,
        numericId: prodMatch[2],
        rawId: `${site}${prodMatch[2]}`,
        kind: "product",
      };
    }
  }

  return null;
}

export function inferSiteFromHost(host: string): string | null {
  if (SITE_DOMAIN_ALIASES[host]) return SITE_DOMAIN_ALIASES[host];
  for (const [suffix, site] of Object.entries(MAIN_SITES)) {
    if (host.endsWith(suffix)) return site;
  }
  return null;
}

/** URL canónica tipo articulo para mostrar/permalink. */
export function buildItemUrl(itemId: MercadoLibreItemId): string {
  return `https://articulo.mercadolibre.com.ve/${itemId.rawId}-_JM`;
}

export function normalizeRawId(raw: string): string {
  return raw.toUpperCase().replace(/-/g, "");
}