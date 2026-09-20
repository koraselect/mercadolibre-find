import type { MercadoLibreItem } from "@/lib/ml/types";
import type { MeliHttpClient } from "@/lib/ml/client";
import { searchCandidates } from "@/lib/ml/search";
import { logger } from "@/lib/logging/logger";

export interface SearchOrchestrationResult {
  candidates: MercadoLibreItem[];
  totalFetched: number;
  queriesUsed: string[];
}

/**
 * Orquesta búsquedas ML: ejecuta N queries, merge y deduplica por ID.
 * Paso 7-9 del pipeline (TODO §22).
 */
export async function orchestrateSearch(
  client: MeliHttpClient,
  queries: string[],
  opts: { site?: string; limitPerQuery?: number } = {}
): Promise<SearchOrchestrationResult> {
  const site = opts.site ?? "MLV";
  const limit = opts.limitPerQuery ?? 10;
  const seen = new Set<string>();
  const candidates: MercadoLibreItem[] = [];
  const queriesUsed: string[] = [];
  let totalFetched = 0;

  for (const q of queries) {
    try {
      const results = await searchCandidates(client, q, { site, limit });
      totalFetched += results.length;
      queriesUsed.push(q);

      for (const item of results) {
        const id = item.id?.rawId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        candidates.push(item);
      }
    } catch (err) {
      logger.debug("search.orchestrate.query_failed", {
        q: q.slice(0, 80),
        cause: String(err).slice(0, 120),
      });
    }
  }

  logger.info("search.orchestrate.done", {
    queries: queriesUsed.length,
    totalFetched,
    unique: candidates.length,
  });

  return { candidates, totalFetched, queriesUsed };
}
