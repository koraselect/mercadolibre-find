"use client";

import { useState } from "react";
import { Crosshair, Loader2, Search, AlertCircle, ExternalLink, TrendingDown, DollarSign, Zap, Image as ImageIcon } from "lucide-react";

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  itemId: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
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

  // Most specific: full keywords on ML Venezuela
  queries.push(`site:articulo.mercadolibre.com.ve ${keywords}`);

  // Category listing
  const slug = words.join("-");
  queries.push(`site:mercadolibre.com.ve ${keywords} precio`);

  // If 4+ words, also try shorter query
  if (words.length > 3) {
    queries.push(`site:articulo.mercadolibre.com.ve ${words.slice(0, 4).join(" ")}`);
  }

  return queries;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [sourcePrice, setSourcePrice] = useState("");
  const [step, setStep] = useState<"idle" | "searching" | "scraping" | "done">("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");

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
        }))
        .filter((c: Candidate) => c.itemId && c.itemId !== sourceItemId);

      // Step 2: Scrape top results for prices + images
      const urlsToScrape = results
        .filter((c) => !c.price)
        .slice(0, 6)
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
            const scrapeMap = new Map<string, { price: number | null; currency: string | null }>();
            for (const sr of scrapeData.results) {
              if (sr.url) scrapeMap.set(sr.url, { price: sr.price, currency: sr.currency });
            }
            results = results.map((c) => {
              const scraped = scrapeMap.get(c.url);
              if (scraped && scraped.price && !c.price) {
                return { ...c, price: scraped.price, currency: scraped.currency };
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
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://articulo.mercadolibre.com.ve/MLV-..."
            className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={step !== "idle"}
          />
          <button
            type="submit"
            disabled={step !== "idle" || !url.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {step !== "idle" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
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
                    {/* Image placeholder area */}
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
