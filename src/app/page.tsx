"use client";

import { useState } from "react";
import { Crosshair, Loader2, Search, AlertCircle, ExternalLink, TrendingDown } from "lucide-react";
import { searchMultipleQueries } from "@/lib/ml/client-search";

const ML_API = "https://api.mercadolibre.com";

interface SourceInfo {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  permalink: string | null;
  attributes: Record<string, string>;
}

interface Alternative {
  itemId: string;
  title: string;
  price: number;
  currency: string | null;
  permalink: string | null;
  savings: number;
  savingsPct: number;
}

interface MatchResult {
  sourceId: string;
  sourcePrice: number | null;
  evaluated: number;
  totalCandidates: number;
  alternatives: Alternative[];
}

function extractIdFromUrl(url: string): string | null {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/([A-Z]{3})-?(\d{6,})/i);
  if (!m) return null;
  return (m[1].toUpperCase() + m[2]);
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"idle" | "resolving" | "searching" | "matching" | "done">("idle");
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchStats, setSearchStats] = useState({ totalFetched: 0, queriesUsed: 0 });

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setStep("resolving");
    setError(null);
    setResult(null);
    setSourceInfo(null);

    try {
      const itemId = extractIdFromUrl(url.trim());
      if (!itemId) {
        throw new Error("No se pudo extraer el ID del producto de la URL");
      }

      // Paso 1: resolver source item desde el navegador
      const itemRes = await fetch(`${ML_API}/items/${itemId}`);
      if (!itemRes.ok) {
        throw new Error(`No se pudo obtener el producto (HTTP ${itemRes.status})`);
      }
      const itemData = await itemRes.json();

      const source: SourceInfo = {
        id: itemData.id,
        title: itemData.title ?? null,
        price: itemData.price ?? null,
        currency: itemData.currency_id ?? null,
        permalink: itemData.permalink ?? null,
        attributes: {},
      };

      // Extract attributes
      if (Array.isArray(itemData.attributes)) {
        for (const attr of itemData.attributes) {
          if (attr.id && attr.value_name) {
            source.attributes[attr.id] = attr.value_name;
          }
        }
      }

      setSourceInfo(source);

      // Paso 2: generar queries simples desde titulo
      const title = source.title ?? "";
      const queries: string[] = [];
      const words = title.split(/\s+/).filter((w: string) => w.length > 2);
      if (words.length > 0) queries.push(words.slice(0, 4).join(" "));
      if (words.length > 3) queries.push(words.slice(0, 6).join(" "));
      if (source.attributes["BRAND"] && source.attributes["MODEL"]) {
        queries.push(`${source.attributes["BRAND"]} ${source.attributes["MODEL"]}`);
      }

      // Paso 3: buscar candidatos desde el navegador
      setStep("searching");
      const site = itemId.slice(0, 3);
      const { candidates, totalFetched, queriesUsed } = await searchMultipleQueries(
        queries.length > 0 ? queries : [title.slice(0, 60)],
        site,
        10
      );
      setSearchStats({ totalFetched, queriesUsed: queriesUsed.length });

      // Paso 4: enviar candidatos al match endpoint
      setStep("matching");
      const matchRes = await fetch("/api/opportunity/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id,
          sourcePrice: source.price,
          candidates: candidates.map((c) => ({
            id: c.id,
            title: c.title,
            price: c.price,
            currency: c.currency,
            permalink: c.permalink,
            sellerId: c.sellerId,
            thumbnail: c.thumbnail,
          })),
        }),
      });
      const matchData = await matchRes.json();

      if (!matchData.ok) {
        throw new Error(matchData.message || "Error al procesar candidatos");
      }

      setResult(matchData);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("idle");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-10">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Crosshair className="size-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          MercadoLibre Opportunity Finder
        </h1>
        <p className="mt-2 text-muted-foreground">
          Encuentra productos equivalentes a menor precio
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAnalyze();
        }}
        className="w-full max-w-2xl mx-auto"
      >
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
            {step !== "idle" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {step === "resolving" ? "Resolviendo..." : step === "searching" ? "Buscando..." : step === "matching" ? "Analizando..." : "Analizar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pega la URL de cualquier publicacion de MercadoLibre Venezuela
        </p>
      </form>

      {step !== "idle" && step !== "done" && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>
            {step === "resolving" && "Obteniendo datos del producto..."}
            {step === "searching" && "Buscando alternativas en MercadoLibre..."}
            {step === "matching" && "Comparando precios..."}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="size-6 mx-auto text-red-600 dark:text-red-400 mb-2" />
          <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {sourceInfo && (
        <div className="mt-8 rounded-xl border bg-card p-6">
          <h3 className="font-semibold text-lg">Producto fuente</h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">ID: {sourceInfo.id}</span>
            {sourceInfo.title && (
              <span className="font-medium">{sourceInfo.title}</span>
            )}
            {sourceInfo.price != null && (
              <span className="text-green-600 dark:text-green-400 font-bold">
                {sourceInfo.currency ?? "$"}{sourceInfo.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{result.totalCandidates} candidatos evaluados</span>
            <span>{searchStats.queriesUsed} queries</span>
          </div>

          {result.alternatives.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Search className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No se encontraron alternativas mas baratas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                El producto ya tiene un precio competitivo o no hay suficientes candidatos.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.alternatives.map((alt) => (
                <div key={alt.itemId} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="size-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          -{(alt.savingsPct * 100).toFixed(1)}%
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium line-clamp-2 text-sm">
                        {alt.title}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {alt.currency ?? "$"}{alt.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ahorro: {alt.currency ?? "$"}{alt.savings.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {alt.permalink && (
                    <a
                      href={alt.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="size-3" />
                      Ver en MercadoLibre
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
