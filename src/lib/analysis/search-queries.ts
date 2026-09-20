import { tokenize, normalizeText } from "@/lib/utils/text";

/**
 * Generación determinística de queries de búsqueda (TODO §9, §43).
 * Es un fallback de costo cero cuando la IA no está disponible o como base
 * de comparación; las queries del fingerprint Gemini suelen ser superiores.
 */

const MAX_QUERIES = 4;
const MAX_QUERY_LEN = 140;

export interface FallbackQueryInput {
  title: string | null;
  brand?: string | null;
  model?: string | null;
}

function unique(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const norm = normalizeText(q);
    if (norm && norm.length >= 3 && !seen.has(norm)) {
      seen.add(norm);
      out.push(q.trim());
    }
  }
  return out;
}

/** Deriva queries de búsqueda a partir del título/marca/modelo del producto. */
export function buildFallbackSearchQueries(input: FallbackQueryInput): string[] {
  const queries: string[] = [];
  const title = input.title?.trim() ?? "";

  if (input.brand && input.model) {
    queries.push(`${input.brand} ${input.model}`);
  }
  if (input.model) {
    queries.push(input.model);
  }
  if (title) {
    queries.push(title.length <= MAX_QUERY_LEN ? title : title.slice(0, MAX_QUERY_LEN).trim());
    const tokens = tokenize(title);
    if (tokens.length > 4) {
      queries.push(tokens.slice(0, 6).join(" "));
    }
  }

  return unique(queries)
    .slice(0, MAX_QUERIES)
    .map((q) => (q.length > MAX_QUERY_LEN ? q.slice(0, MAX_QUERY_LEN).trim() : q));
}