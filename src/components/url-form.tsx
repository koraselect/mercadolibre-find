"use client";

import { useState } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";

interface UrlFormProps {
  onAnalyze: (url: string) => void;
  isLoading?: boolean;
}

export function UrlForm({ onAnalyze, isLoading }: UrlFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://articulo.mercadolibre.com.ve/MLV-..."
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Analizar
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Pega la URL de cualquier publicación de MercadoLibre Venezuela
      </p>
    </form>
  );
}
