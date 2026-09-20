/** Remueve acentos y retorna minúsculas normalizadas (para comparaciones). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Tokeniza un texto en palabras/letras/números útiles. */
export function tokenize(value: string): string[] {
  const tokens = normalizeText(value).match(/[a-z0-9]+/g) ?? [];
  const stop = new Set([
    "de", "la", "el", "en", "y", "a", "o", "u", "del", "para", "con",
    "por", "un", "una", "los", "las", "que", "se", "al", "su",
  ]);
  return tokens.filter((t) => !stop.has(t) && t.length > 1);
}

/** Similitud de Jaccard sobre tokens. Devuelve [0,1]. */
export function similarityTokens(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

/** Similitud de caracteres (bigrama) para títulos con ruido. Devuelve [0,1]. */
export function similarityBigram(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 || nb.length === 0) return 0;
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  const union = ba.size + bb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Slug corto para URLs/ids amigables. */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Slice seguro de texto con sufijo. */
export function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

export function isNumeric(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}