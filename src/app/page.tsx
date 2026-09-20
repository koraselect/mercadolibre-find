"use client";

import { useState, useRef, useCallback } from "react";
import { Crosshair, Loader2, Search, AlertCircle, ExternalLink, TrendingDown, DollarSign, Zap, Image as ImageIcon, Check, Pause } from "lucide-react";

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  itemId: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  isPaused: boolean;
}

interface SourceData {
  title: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  itemId: string | null;
}

function extractKeywords(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const slug = clean.split("/").pop()?.replace(/-JM$/i, "") ?? "";
  return slug
    .split("-")
    .filter((w) => w.length > 2 && !w.match(/^MLV\d+$/i) && !w.match(/^\d+$/))
    .join(" ");
}

function extractItemId(url: string): string | null {
  const m = url.match(/([A-Z]{3})-?(\d{6,})/i);
  return m ? m[1].toUpperCase() + m[2] : null;
}

function extractPrice(text: string): number | null {
  const patterns = [
    /US\$\s*([\d.,]+)/i,
    /(?:USD|\$)\s*([\d.,]+)/i,
    /(?:Bs\.?|VES)\s*([\d.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const numStr = m[1].replace(/\./g, "").replace(",", ".");
      const num = parseFloat(numStr);
      if (num > 0 && num < 1000000) return num;
    }
  }
  return null;
}

function buildQueries(keywords: string): string[] {
  const words = keywords.split(/\s+/).filter((w) => w.length > 2);
  const queries: string[] = [];

  queries.push(`site:articulo.mercadolibre.com.ve ${keywords}`);

  const slug = words.join("-");
  queries.push(`site:mercadolibre.com.ve ${keywords} precio`);

  if (words.length > 3) {
    queries.push(`site:articulo.mercadolibre.com.ve ${words.slice(0, 4).join(" ")}`);
  }

  return queries;
}

/**
 * Option A: Browser fetch - the browser fetches the ML page directly.
 * ML serves full HTML to browsers (no verification wall).
 */
async function browserFetchSource(url: string): Promise<SourceData | null> {
  try {
    const res = await fetch(url, {
      credentials: "omit",
      headers: { Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Verify it's a real product page, not a verification wall
    if (html.includes("suspicious-traffic") || html.includes("verificación")) return null;

    const itemId = extractItemId(url);

    // Extract title
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleTag?.[1]?.trim() ?? null;
    if (title) {
      title = title.replace(/\s*-\s*(?:US\$\s*[\d.,]+|(?:USD|\$)\s*[\d.,]+|Bs\.?\s*[\d.,]+)\s*$/i, "").trim();
    }

    // Extract price from meta itemprop="price"
    let price: number | null = null;
    const priceMeta = html.match(/<meta\s+itemprop="price"\s+content="([^"]+)"/i);
    if (priceMeta) {
      price = parseFloat(priceMeta[1]);
      if (isNaN(price)) price = null;
    }

    // Fallback: aria-label
    if (price === null) {
      const ariaPrice = html.match(/aria-label="(\d+)\s*dólares?\s*con\s*(\d+)\s*centavos?"/i);
      if (ariaPrice) price = parseFloat(`${ariaPrice[1]}.${ariaPrice[2]}`);
    }

    // Fallback: og:title
    if (price === null && titleTag) {
      const pm = titleTag[1].match(/US\$\s*([\d.,]+)/i);
      if (pm) {
        price = parseFloat(pm[1].replace(/\./g, "").replace(",", "."));
        if (isNaN(price)) price = null;
      }
    }

    // Extract image from og:image
    const ogImage = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      ?? html.match(/<meta\s+content="([^"]+)"\s+(?:property|name)="og:image"/i);
    let imageUrl = ogImage?.[1] ?? null;

    if (!imageUrl) {
      const thumbMatch = html.match(/ui-pdp-outside_variations__thumbnails__item__picture[^>]+src="([^"]+)"/i);
      if (thumbMatch) imageUrl = thumbMatch[1];
    }

    return { title, price, currency: price !== null ? "USD" : null, imageUrl, itemId };
  } catch {
    // CORS or network error
    return null;
  }
}

/**
 * Option B: API fallback - server-side Firecrawl scrape.
 */
async function apiFetchSource(url: string): Promise<SourceData | null> {
  try {
    const res = await fetch("/api/scrape-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.ok) return data as SourceData;
    return null;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [sourcePrice, setSourcePrice] = useState("");
  const [step, setStep] = useState<"idle" | "extracting" | "searching" | "scraping" | "done">("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-extract source data when URL changes
  const handleUrlChange = useCallback(async (newUrl: string) => {
    setUrl(newUrl);
    setSourceData(null);
    setExtractionMethod(null);

    if (!newUrl.includes("mercadolibre")) return;

    setStep("extracting");

    // Option A: Browser fetch first
    const browserData = await browserFetchSource(newUrl);
    if (browserData && (browserData.title || browserData.price !== null)) {
      setSourceData(browserData);
      setExtractionMethod("browser");
      if (browserData.price && !sourcePrice) {
        setSourcePrice(browserData.price.toString());
      }
      setStep("idle");
      return;
    }

    // Option B: API fallback
    const apiData = await apiFetchSource(newUrl);
    if (apiData && (apiData.title || apiData.price !== null)) {
      setSourceData(apiData);
      setExtractionMethod("api");
      if (apiData.price && !sourcePrice) {
        setSourcePrice(apiData.price.toString());
      }
    }

    setStep("idle");
  }, [sourcePrice]);

  const handleUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleUrlChange(val), 600);
    setUrl(val);
  };

  const handleSearch = async () => {
    if (!url.trim()) return;
    setStep("searching");
    setError(null);
    setCandidates([]);

    try {
      const kws = extractKeywords(url.trim());
      if (!kws) throw new Error("No se pudieron extraer palabras clave de la URL");
      setKeywords(kws);

      const sourceItemId = extractItemId(url.trim());
      const queries = buildQueries(kws);

      // Step 1: Search
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries, sourceKeywords: kws, maxResults: 15 }),
      });
      const searchData = await searchRes.json();
      if (!searchData.ok) throw new Error(searchData.error || "Error en busqueda");

      let results: Candidate[] = searchData.results
        .map((r: { title: string; url: string; snippet: string }) => ({
          title: r.title,
          url: r.url.split("?")[0],
          snippet: r.snippet,
          itemId: extractItemId(r.url),
          price: extractPrice(r.snippet + " " + r.title),
          currency: null,
          imageUrl: null,
          isPaused: false,
        }))
        .filter((c: Candidate) => c.itemId && c.itemId !== sourceItemId);

      // Step 2: Scrape ALL candidates for images + prices + pause detection
      const urlsToScrape = results
        .filter((c) => !c.price || !c.imageUrl)
        .slice(0, 8)
        .map((c) => c.url);

      if (urlsToScrape.length > 0) {
        setStep("scraping");
        try {
          const scrapeRes = await fetch("/api/scrape-ml", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: urlsToScrape }),
          });
          const scrapeData = await scrapeRes.json();
          if (scrapeData.ok && scrapeData.results) {
            const scrapeMap = new Map<string, { price: number | null; currency: string | null; imageUrl: string | null; isPaused: boolean }>();
            for (const sr of scrapeData.results) {
              if (sr.url) scrapeMap.set(sr.url, { price: sr.price, currency: sr.currency, imageUrl: sr.imageUrl, isPaused: sr.isPaused });
            }
            results = results.map((c) => {
              const scraped = scrapeMap.get(c.url);
              if (scraped) {
                return {
                  ...c,
                  price: scraped.price && !c.price ? scraped.price : c.price,
                  currency: scraped.currency || c.currency,
                  imageUrl: scraped.imageUrl || c.imageUrl,
                  isPaused: scraped.isPaused || c.isPaused,
                };
              }
              return c;
            });
          }
        } catch {
          // Continue without scraped prices
        }
      }

      setCandidates(results);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("idle");
    }
  };

  const srcPrice = parseFloat(sourcePrice) || 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-10">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Crosshair className="size-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Opportunity Finder</h1>
        <p className="mt-2 text-muted-foreground">
          Encuentra productos equivalentes a menor precio en MercadoLibre
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="w-full max-w-2xl mx-auto space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={handleUrlInput}
            placeholder="https://articulo.mercadolibre.com.ve/MLV-..."
            className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={step !== "idle" && step !== "extracting"}
          />
          <button
            type="submit"
            disabled={step === "searching" || step === "scraping" || !url.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {step === "searching" || step === "scraping" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {step === "searching" ? "Buscando..." : step === "scraping" ? "Obteniendo precios..." : "Buscar"}
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="flex gap-2 items-center flex-1">
            <DollarSign className="size-4 text-muted-foreground" />
            <input
              type="text"
              inputMode="decimal"
              value={sourcePrice}
              onChange={(e) => setSourcePrice(e.target.value)}
              placeholder="Precio del producto fuente"
              className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
        </div>
      </form>

      {/* Source preview card */}
      {sourceData && (sourceData.title || sourceData.imageUrl) && (
        <div className="w-full max-w-2xl mx-auto mt-4 rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-1 px-3 pt-2 text-xs text-muted-foreground">
            <Check className="size-3 text-green-600" />
            <span>Datos extraídos {extractionMethod === "browser" ? "(navegador)" : "(API)"}</span>
          </div>
          <div className="flex gap-3 p-3">
            {sourceData.imageUrl && (
              <div className="shrink-0 size-16 rounded-lg bg-muted overflow-hidden">
                <img src={sourceData.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {sourceData.title && (
                <p className="text-sm font-medium line-clamp-2">{sourceData.title}</p>
              )}
              {sourceData.price !== null && (
                <p className="text-lg font-bold mt-1">${sourceData.price.toFixed(2)}</p>
              )}
              {sourceData.itemId && (
                <p className="text-xs text-muted-foreground font-mono mt-1">{sourceData.itemId}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "extracting" && (
        <div className="w-full max-w-2xl mx-auto mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Extrayendo datos del producto...</span>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="size-6 mx-auto text-red-600 dark:text-red-400 mb-2" />
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {(step === "searching" || step === "scraping") && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>
            {step === "searching" && "Buscando productos similares..."}
            {step === "scraping" && "Obteniendo precios de productos..."}
          </span>
        </div>
      )}

      {step === "done" && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {candidates.length} productos encontrados
            </h2>
            {keywords && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {keywords}
              </span>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Search className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No se encontraron productos similares</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Intenta con otra URL o ajusta la busqueda.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {candidates.map((c, i) => {
                const diff = srcPrice > 0 && c.price ? srcPrice - c.price : null;
                const pct = diff && srcPrice ? ((diff / srcPrice) * 100).toFixed(1) : null;

                return (
                  <div key={c.itemId ?? i} className="rounded-xl border bg-card overflow-hidden">
                    <div className="h-32 bg-muted flex items-center justify-center relative">
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="size-8" />
                          <span className="text-xs">Sin imagen</span>
                        </div>
                      )}
                      {diff && diff > 0 && pct && (
                        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                          -{pct}%
                        </div>
                      )}
                      {diff && diff < 0 && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          +{Math.abs(parseFloat(pct!)).toFixed(1)}%
                        </div>
                      )}
                      {c.isPaused && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                          <Pause className="size-3" />
                          Pausado
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-2 text-sm">{c.title}</h4>
                          {diff && diff > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <TrendingDown className="size-3 text-green-600" />
                              <span className="text-xs font-medium text-green-600">
                                Ahorro: ${diff.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {c.price ? (
                            <div className="text-lg font-bold">${c.price.toFixed(2)}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">Ver precio</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">{c.itemId}</span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="size-3" />
                          Ver en ML
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
