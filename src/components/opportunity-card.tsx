import { ExternalLink, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

interface OpportunityCardProps {
  title: string;
  price: number;
  currency: string | null;
  savings: number;
  savingsPct: number;
  level: "HIGH" | "MEDIUM" | "REVIEW" | "REJECT";
  riskLevel: "low" | "medium" | "high";
  url?: string;
  marginPercent?: number;
}

const levelConfig = {
  HIGH: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-800",
    label: "Alta",
  },
  MEDIUM: {
    icon: TrendingUp,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    label: "Media",
  },
  REVIEW: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Revisar",
  },
  REJECT: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    label: "Rechazada",
  },
};

export function OpportunityCard({
  title,
  price,
  currency,
  savings,
  savingsPct,
  level,
  riskLevel,
  url,
  marginPercent,
}: OpportunityCardProps) {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`size-4 ${config.color}`} />
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
            {riskLevel === "high" && (
              <span className="text-xs text-red-600 dark:text-red-400">Riesgo alto</span>
            )}
          </div>
          <h4 className="mt-1 font-medium line-clamp-2">{title}</h4>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{currency ?? "$"}{price.toFixed(2)}</div>
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">
            -{savingsPct.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Ahorro: {currency ?? "$"}{savings.toFixed(2)}</span>
        {marginPercent != null && (
          <span>Margin: {marginPercent.toFixed(1)}%</span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <ExternalLink className="size-3" />
            Ver
          </a>
        )}
      </div>
    </div>
  );
}
