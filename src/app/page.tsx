"use client";

import { useState } from "react";
import { Crosshair, Loader2, Search, AlertCircle, ExternalLink, TrendingDown, DollarSign, Zap } from "lucide-react";

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  itemId: string | null;
  price: number | null;
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
    /(?:USD|\$)\s*([\d.,]+)/i,
    /(?:Bs\.?|VES)\s*([\d.,]+)/i,
    /precio[:\s]*(?:USD|\$|Bs\.?)?\s*([\d.,]+)/i,
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

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [sourcePrice, setSourcePrice] = useState("");
  const [step, setStep] = useState<"idle" | "searching" | "done">("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");
  const [searchMethod, setSearchMethod] = useState<"tavily" | "ddg">("tavily");

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

      if (searchMethod === "tavily") {
        // Use Firecrawl search via server API
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `site:mercadolibre.com.ve ${kws}`,
            maxResults: 15,
          }),
        });
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Error en la busqueda");

        const results: Candidate[] = data.results
          .map((r: { title: string; url: string; snippet: string }) => {
            const id = extractItemId(r.url);
            return {
              title: r.title,
              url: r.url.split("?")[0],
              snippet: r.snippet,
              itemId: id,
              price: extractPrice(r.snippet + " " + r.title),
            };
          })
          .filter((c: Candidate) => c.itemId && c.itemId !== sourceItemId);

        setCandidates(results);
      } else {
        // Fallback: DuckDuckGo from browser
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent("site:mercadolibre.com.ve " + kws)}`;
        const res = await fetch(ddgUrl, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
        });
        const html = await res.text();

        const results: Candidate[] = [];
        const seen = new Set<string>();
        const blocks = html.split(/class="result__body"/g);

        for (const block of blocks) {
          const titleMatch = block.match(/class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
          const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
          if (!titleMatch) continue;

          const rawUrl = titleMatch[1];
          const title = titleMatch[2].replace(/<[^>]+>/g, "").trim();
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";

          const realUrlMatch = rawUrl.match(/uddg=([^&]+)/);
          const realUrl = realUrlMatch ? decodeURIComponent(realUrlMatch[1]) : rawUrl;

          if (!realUrl.includes("mercadolibre.com.ve")) continue;
          const id = extractItemId(realUrl);
          if (!id || seen.has(id) || id === sourceItemId) continue;
          seen.add(id);

          results.push({
            title,
            url: realUrl.split("?")[0],
            snippet,
            itemId: id,
            price: extractPrice(snippet + " " + title),
          });
        }

        setCandidates(results);
      }

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
            {step === "searching" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {step === "searching" ? "Buscando..." : "Buscar"}
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="size-3" />
            <select
              value={searchMethod}
              onChange={(e) => setSearchMethod(e.target.value as "tavily" | "ddg")}
              className="rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="tavily">Tavily (IA)</option>
              <option value="ddg">DuckDuckGo</option>
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="size-6 mx-auto text-red-600 dark:text-red-400 mb-2" />
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {step === "searching" && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Buscando productos similares con {searchMethod === "tavily" ? "Tavily AI" : "DuckDuckGo"}...</span>
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
                  <div key={c.itemId ?? i} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {diff && diff > 0 && pct && (
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingDown className="size-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              -{pct}% (ahorro ${diff.toFixed(2)})
                            </span>
                          </div>
                        )}
                        {diff && diff < 0 && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm font-medium text-red-600">
                              +{Math.abs(parseFloat(pct!)).toFixed(1)}% (mas caro)
                            </span>
                          </div>
                        )}
                        <h4 className="font-medium line-clamp-2 text-sm">{c.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {c.snippet}
                        </p>
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
