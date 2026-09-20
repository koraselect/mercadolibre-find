import type { MercadoLibreItem } from "@/lib/ml/types";
import { buildProductDigest } from "@/lib/analysis/normalize";

export interface PreScoredCandidate {
  item: MercadoLibreItem;
  score: number;
  breakdown: {
    titleSimilarity: number;
    brandMatch: number;
    modelMatch: number;
    priceAdvantage: number;
    attributeOverlap: number;
  };
}

/** Pesos del pre-score (TODO §23). */
const WEIGHTS = {
  titleSimilarity: 0.30,
  brandMatch: 0.15,
  modelMatch: 0.20,
  priceAdvantage: 0.15,
  attributeOverlap: 0.20,
} as const;

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toUpperCase();
}

/** Similitud simple de tokens entre dos strings (Jaccard). */
function tokenSimilarity(a: string, b: string): number {
  const tokA = new Set(a.split(/[^A-Z0-9]+/).filter(Boolean));
  const tokB = new Set(b.split(/[^A-Z0-9]+/).filter(Boolean));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokA) if (tokB.has(t)) intersection++;
  return intersection / (tokA.size + tokB.size - intersection);
}

/** Coincidencia binaria de marca (1 si matchea, 0 si no). */
function brandScore(src: string | null, cand: string | null): number {
  const a = norm(src);
  const b = norm(cand);
  if (!a || !b) return 0;
  return a === b ? 1 : 0;
}

/** Coincidencia binaria de modelo (1 si matchea, 0 si no). */
function modelScore(src: string | null, cand: string | null): number {
  const a = norm(src);
  const b = norm(cand);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  return 0;
}

/** Ventaja de precio: 1 si es más barato, proporcional al ahorro. */
function priceAdvantage(srcPrice: number | null, candPrice: number | null): number {
  if (srcPrice == null || candPrice == null || srcPrice <= 0) return 0;
  if (candPrice >= srcPrice) return 0;
  const savings = (srcPrice - candPrice) / srcPrice;
  return Math.min(savings * 5, 1); // 20% ahorro → score 1.0
}

/** Overlap de atributos: proporción de atributos compartidos. */
function attributeOverlap(
  srcAttrs: Record<string, string>,
  candAttrs: Record<string, string>
): number {
  const srcKeys = Object.keys(srcAttrs);
  const candKeys = Object.keys(candAttrs);
  if (srcKeys.length === 0 || candKeys.length === 0) return 0;
  let matches = 0;
  for (const k of srcKeys) {
    if (candAttrs[k] && norm(srcAttrs[k]) === norm(candAttrs[k])) matches++;
  }
  return matches / Math.max(srcKeys.length, candKeys.length);
}

/**
 * Calcula pre-score determinístico de un candidato contra el source.
 * Paso 23 del pipeline (TODO §23): decide qué candidatos van a IA.
 */
export function preScoreCandidate(
  source: MercadoLibreItem,
  candidate: MercadoLibreItem
): PreScoredCandidate {
  const srcDigest = buildProductDigest(source);
  const candDigest = buildProductDigest(candidate);

  const titleSim = tokenSimilarity(
    norm(srcDigest.title),
    norm(candDigest.title)
  );
  const brand = brandScore(srcDigest.brand, candDigest.brand);
  const model = modelScore(srcDigest.model, candDigest.model);
  const price = priceAdvantage(srcDigest.price, candDigest.price);
  const attrs = attributeOverlap(srcDigest.attributes, candDigest.attributes);

  const score =
    titleSim * WEIGHTS.titleSimilarity +
    brand * WEIGHTS.brandMatch +
    model * WEIGHTS.modelMatch +
    price * WEIGHTS.priceAdvantage +
    attrs * WEIGHTS.attributeOverlap;

  return {
    item: candidate,
    score: Math.round(score * 1000) / 1000,
    breakdown: {
      titleSimilarity: Math.round(titleSim * 100) / 100,
      brandMatch: brand,
      modelMatch: model,
      priceAdvantage: Math.round(price * 100) / 100,
      attributeOverlap: Math.round(attrs * 100) / 100,
    },
  };
}

/**
 * Rankea candidatos por pre-score y devuelve los top N.
 * Solo estos van a IA (control de costos, TODO §24).
 */
export function rankCandidatesForAI(
  source: MercadoLibreItem,
  candidates: MercadoLibreItem[],
  maxCandidates: number = 10
): PreScoredCandidate[] {
  const scored = candidates.map((c) => preScoreCandidate(source, c));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCandidates);
}
