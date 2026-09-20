export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Porcentaje de diferencia relativa (base = origin). */
export function percentChange(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}

/** Formatea un ratio (0.1) como porcentaje legible ("10%"). */
export function formatPercent(ratio: number, decimals = 0): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

/** Normaliza un ratio a [0,1] tolerando valores fuera de rango. */
export function normalize01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}