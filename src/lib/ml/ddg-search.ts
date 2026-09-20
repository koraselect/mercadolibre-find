export interface SearchCandidate {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  permalink: string;
  source: "ddg";
}

function extractKeywordsFromUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const slug = clean.split("/").pop()?.replace(/-JM$/i, "") ?? "";
  const words = slug
    .split("-")
    .filter((w) => w.length > 2 && !w.match(/^MLV\d+$/i) && !w.match(/^\d+$/));
  return words.join(" ");
}

function extractItemIdFromUrl(url: string): string | null {
  const m = url.match(/([A-Z]{3})-?(\d{6,})/i);
  if (!m) return null;
  return m[1].toUpperCase() + m[2];
}

/**
 * Busca candidatos usando DuckDuckGo HTML (funciona desde el browser sin API key).
 * Retorna links a MercadoLibre con titles extraidos del snippet.
 */
export async function searchViaDuckDuckGo(
  keywords: string,
  site: string = "mercadolibre.com.ve",
  maxResults: number = 20
): Promise<SearchCandidate[]> {
  const query = `site:${site} ${keywords}`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });

  const html = await res.text();
  const candidates: SearchCandidate[] = [];
  const seen = new Set<string>();

  // Extract result blocks
  const resultRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match;
  while ((match = resultRegex.exec(html)) && candidates.length < maxResults) {
    const rawUrl = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    const snippet = match[3].replace(/<[^>]+>/g, "").trim();

    // Follow DDG redirect to get real URL
    const realUrlMatch = rawUrl.match(/uddg=([^&]+)/);
    const realUrl = realUrlMatch
      ? decodeURIComponent(realUrlMatch[1])
      : rawUrl;

    if (!realUrl.includes("mercadolibre.com")) continue;

    const itemId = extractItemIdFromUrl(realUrl);
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);

    // Try to extract price from snippet
    const priceMatch = snippet.match(
      /(?:USD|\$|Bs\.?|VES)\s*([\d.,]+)/i
    );
    const price = priceMatch
      ? parseFloat(priceMatch[1].replace(/[.,]/g, (m) => (m === "." ? "." : "")))
      : null;

    candidates.push({
      id: itemId,
      title,
      price,
      currency: priceMatch ? (priceMatch[0].includes("USD") ? "USD" : "$") : null,
      permalink: realUrl.split("?")[0],
      source: "ddg",
    });
  }

  return candidates;
}

/**
 * Busca en multiples queries y deduplica.
 */
export async function searchMultipleDDG(
  queries: string[],
  site: string = "mercadolibre.com.ve",
  maxPerQuery: number = 10
): Promise<{ candidates: SearchCandidate[]; totalResults: number; queriesUsed: string[] }> {
  const allCandidates: SearchCandidate[] = [];
  const usedQueries: string[] = [];

  for (const q of queries) {
    try {
      const results = await searchViaDuckDuckGo(q, site, maxPerQuery);
      allCandidates.push(...results);
      if (results.length > 0) usedQueries.push(q);
    } catch {
      // Skip failed queries
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = allCandidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return {
    candidates: unique,
    totalResults: unique.length,
    queriesUsed: usedQueries,
  };
}

export { extractKeywordsFromUrl, extractItemIdFromUrl };
