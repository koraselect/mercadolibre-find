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

const MIN_SAVINGS_PCT = 0.03;

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toUpperCase();
}

/** Tokeniza un titulo en palabras clave normalizadas. */
function tokenizeTitle(title: string): Set<string> {
  const words = norm(title)
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 2);
  return new Set(words);
}

/** Calcula overlap de tokens (Jaccard simplificado). */
function titleOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let match = 0;
  for (const w of a) if (b.has(w)) match++;
  return match / Math.min(a.size, b.size);
}

function isSameProduct(a: MercadoLibreItem, b: MercadoLibreItem): boolean {
  const da = buildProductDigest(a);
  const db = buildProductDigest(b);

  // 1. MPN exacto (match mas fuerte)
  const aMpn = norm(da.mpn);
  const bMpn = norm(db.mpn);
  if (aMpn && bMpn && aMpn === bMpn) return true;

  // 2. Brand + Model exactos
  if (
    da.brand && db.brand && da.model && db.model &&
    norm(da.brand) === norm(db.brand) &&
    norm(da.model) === norm(db.model)
  ) {
    return true;
  }

  // 3. Similitud de titulo (fallback cuando attributes estan incompletos)
  const srcTitle = norm(a.title ?? "");
  const candTitle = norm(b.title ?? "");
  if (srcTitle && candTitle) {
    const srcTokens = tokenizeTitle(srcTitle);
    const candTokens = tokenizeTitle(candTitle);
    const overlap = titleOverlap(srcTokens, candTokens);
    if (overlap >= 0.6) return true;
  }

  return false;
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
