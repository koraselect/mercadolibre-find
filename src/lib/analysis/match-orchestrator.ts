import type { MercadoLibreItem } from "@/lib/ml/types";
import type { AIProvider, AIMatchResult } from "@/lib/ai/types";
import type { ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
import { logger } from "@/lib/logging/logger";

export interface MatchCandidateResult {
  candidateId: string;
  result: AIMatchResult;
}

/**
 * Ejecuta matching IA en un lote de candidatos (TODO §24, §42).
 * Controla costos: solo evalúa los top N candidatos pre-seleccionados.
 */
export async function matchCandidates(
  provider: AIProvider,
  source: MercadoLibreItem,
  candidates: MercadoLibreItem[],
  fingerprint: ProductFingerprint,
  opts: { maxCandidates?: number } = {}
): Promise<MatchCandidateResult[]> {
  const max = opts.maxCandidates ?? 10;
  const results: MatchCandidateResult[] = [];
  const toProcess = candidates.slice(0, max);

  logger.info("match.start", {
    provider: provider.name,
    candidates: toProcess.length,
    sourceId: source.id?.rawId,
  });

  for (const candidate of toProcess) {
    const candidateId = candidate.id?.rawId ?? "unknown";
    try {
      const result = await provider.matchCandidate(source, candidate, fingerprint);
      results.push({ candidateId, result });
    } catch (err) {
      logger.warn("match.candidate_failed", {
        candidateId,
        cause: String(err).slice(0, 160),
      });
    }
  }

  logger.info("match.done", {
    provider: provider.name,
    matched: results.filter((r) => r.result.sameProduct).length,
    total: results.length,
  });

  return results;
}
