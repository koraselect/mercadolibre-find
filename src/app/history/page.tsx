"use client";

import { useState, useEffect } from "react";
import { Clock, ExternalLink, Loader2 } from "lucide-react";

interface Analysis {
  id: string;
  sourceItemId: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourcePrice: number | null;
  sourceCurrency: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history?limit=20");
      const data = await res.json();
      if (data.ok) {
        setAnalyses(data.analyses);
      } else {
        setError(data.message || "Error al cargar historial");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Historial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Analisis anteriores guardados en la base de datos.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-card p-8 text-center">
          <Clock className="size-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Sin analisis aun</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Analiza tu primera publicacion para ver el historial aqui.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {analyses.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">
                  {a.sourceTitle ?? a.sourceItemId}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {a.sourcePrice != null
                      ? `${a.sourceCurrency ?? "$"}${a.sourcePrice.toFixed(2)}`
                      : "Sin precio"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : a.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {a.status}
                  </span>
                  <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <a
                href={a.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="size-3" />
                ML
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
