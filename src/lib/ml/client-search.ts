/**
 * Buscador client-side de MercadoLibre.
 * Llama a la API de ML desde el navegador (CORS permitido).
 * El servidor tiene la API bloqueada (PolicyAgent 403).
 */

const ML_API = "https://api.mercadolibre.com";

export interface MLCandidate {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  permalink: string | null;
  sellerId: string | null;
  thumbnail: string | null;
  condition: string | null;
  shipping: { free: boolean } | null;
}

interface MLSearchResponse {
  results: Array<{
    id: string;
    title: string | null;
    price: number | null;
    currency_id: string | null;
    permalink: string | null;
    seller?: { id?: number | null } | null;
    thumbnail: string | null;
    condition: string | null;
    shipping?: { free_shipping?: boolean } | null;
  }>;
}

/**
 * Busca candidatos en ML directamente desde el navegador.
 * NO requiere token de usuario — funciona con CORS público.
 */
export async function searchMLFromBrowser(
  query: string,
  site: string = "MLV",
  limit: number = 10
): Promise<MLCandidate[]> {
  const url = `${ML_API}/sites/${site}/search?q=${encodeURIComponent(query)}&limit=${limit}&status=active`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`ML search failed: ${res.status}`);
  }

  const data: MLSearchResponse = await res.json();

  return (data.results ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? null,
    price: r.price ?? null,
    currency: r.currency_id ?? null,
    permalink: r.permalink ?? null,
    sellerId: r.seller?.id != null ? String(r.seller.id) : null,
    thumbnail: r.thumbnail ?? null,
    condition: r.condition ?? null,
    shipping: r.shipping ? { free: r.shipping.free_shipping ?? false } : null,
  }));
}

/**
 * Busca múltiples queries y deduplica por ID.
 */
export async function searchMultipleQueries(
  queries: string[],
  site: string = "MLV",
  limitPerQuery: number = 10
): Promise<{ candidates: MLCandidate[]; totalFetched: number; queriesUsed: string[] }> {
  const seen = new Set<string>();
  const candidates: MLCandidate[] = [];
  const queriesUsed: string[] = [];
  let totalFetched = 0;

  for (const q of queries) {
    try {
      const results = await searchMLFromBrowser(q, site, limitPerQuery);
      totalFetched += results.length;
      queriesUsed.push(q);

      for (const item of results) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        candidates.push(item);
      }
    } catch {
      // Silently skip failed queries
    }
  }

  return { candidates, totalFetched, queriesUsed };
}
