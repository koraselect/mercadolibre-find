"use client";

import { SourceCard } from "./source-card";
import { OpportunityCard } from "./opportunity-card";
import { Loader2, BarChart3, Search } from "lucide-react";

interface AnalysisResult {
  sourceId: string;
  sourcePrice: number;
  channel: string;
  queries: string[];
  stats: {
    totalFetched: number;
    uniqueCandidates: number;
    sentToAI: number;
  };
  alternatives: Array<{
    itemId: string;
    title: string;
    price: number;
    currency: string | null;
    permalink: string | null;
    savings: number;
    savingsPct: number;
  }>;
}

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  isLoading?: boolean;
  error?: string | null;
}

export function AnalysisResults({ result, isLoading, error }: AnalysisResultsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin mb-4" />
        <p className="text-lg font-medium">Analizando producto...</p>
        <p className="text-sm">Buscando alternativas en MercadoLibre</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
        <p className="text-red-800 dark:text-red-200 font-medium">Error al analizar</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BarChart3 className="size-4" />
        <span>
          {result.stats.uniqueCandidates} candidatos evaluados,{' '}
          {result.stats.sentToAI} enviados a IA
        </span>
        <span className="text-xs">({result.channel})</span>
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
            <OpportunityCard
              key={alt.itemId}
              title={alt.title}
              price={alt.price}
              currency={alt.currency}
              savings={alt.savings}
              savingsPct={alt.savingsPct}
              level="MEDIUM"
              riskLevel="low"
              url={alt.permalink ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
