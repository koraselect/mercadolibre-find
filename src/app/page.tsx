"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { UrlForm } from "@/components/url-form";
import { SourceCard } from "@/components/source-card";
import { AnalysisResults } from "@/components/analysis-results";

export default function HomePage() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.message || "Error al analizar");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
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

      <UrlForm onAnalyze={handleAnalyze} isLoading={isLoading} />

      <div className="mt-10">
        <AnalysisResults result={result} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}
