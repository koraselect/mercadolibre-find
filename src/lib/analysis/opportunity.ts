import type { MercadoLibreItem } from "@/lib/ml/types";
import { buildProductDigest } from "@/lib/analysis/normalize";

export interface CheaperAlternative {
  itemId: string;
  title: string;
  price: number;
  currency: string | null;
  permalink: string | null;
  savings: number;
  savingsPct: number;
}

export interface OpportunityResult {
  sourceId: string;
  sourcePrice: number;
  alternatives: CheaperAlternative[];
  evaluated: number;
}

const MIN_SAVINGS_PCT = 0.05;

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toUpperCase();
}

function isSameProduct(a: MercadoLibreItem, b: MercadoLibreItem): boolean {
  const da = buildProductDigest(a);
  const db = buildProductDigest(b);
  const aMpn = norm(da.mpn);
  const bMpn = norm(db.mpn);
  if (aMpn && bMpn && aMpn === bMpn) return true;
  return Boolean(
    da.brand && db.brand && da.model && db.model &&
    norm(da.brand) === norm(db.brand) &&
    norm(da.model) === norm(db.model)
  );
}

export function findCheaperAlternatives(
  source: MercadoLibreItem,
  candidates: MercadoLibreItem[]
): OpportunityResult {
  const srcDigest = buildProductDigest(source);
  const sourcePrice = srcDigest.price;
  if (sourcePrice == null) {
    return { sourceId: srcDigest.itemId ?? "", sourcePrice: 0, alternatives: [], evaluated: 0 };
  }

  const seen = new Set<string>();
  const alternatives: CheaperAlternative[] = [];

  for (const cand of candidates) {
    const candId = cand.id?.rawId ?? "";
    if (!candId || candId === srcDigest.itemId) continue;
    if (seen.has(candId)) continue;
    seen.add(candId);
    if (!isSameProduct(source, cand)) continue;

    const candPrice = cand.price;
    if (candPrice == null || candPrice >= sourcePrice) continue;

    const savings = sourcePrice - candPrice;
    const savingsPct = savings / sourcePrice;
    if (savingsPct < MIN_SAVINGS_PCT) continue;

    alternatives.push({
      itemId: candId,
      title: cand.title ?? "",
      price: candPrice,
      currency: cand.currency ?? null,
      permalink: cand.permalink ?? null,
      savings,
      savingsPct,
    });
  }

  alternatives.sort((x, y) => y.savingsPct - x.savingsPct);
  return { sourceId: srcDigest.itemId ?? "", sourcePrice, alternatives, evaluated: candidates.length };
}
