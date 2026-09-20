import { ExternalLink, Tag, DollarSign } from "lucide-react";

interface SourceCardProps {
  title: string | null;
  price: number | null;
  currency: string | null;
  brand: string | null;
  model: string | null;
  itemId: string;
  url?: string;
}

export function SourceCard({
  title,
  price,
  currency,
  brand,
  model,
  itemId,
  url,
}: SourceCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg line-clamp-2">{title ?? "Sin titulo"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {brand && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Tag className="size-3" />
                {brand}
              </span>
            )}
            {model && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                {model}
              </span>
            )}
          </div>
        </div>
        {price != null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {currency ?? "$"}{price.toFixed(2)}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span>ID: {itemId}</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <ExternalLink className="size-3" />
            Ver en ML
          </a>
        )}
      </div>
    </div>
  );
}
