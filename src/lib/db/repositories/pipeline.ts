import { analysisRepository, type AnalysisRecord } from "@/lib/db/repositories/analysis";
import { opportunityRepository } from "@/lib/db/repositories/opportunity";
import type { MercadoLibreItem } from "@/lib/ml/types";
import type { ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
import type { AIMatchResult } from "@/lib/ai/schemas/matching";
import type { ProfitabilityResult } from "@/lib/analysis/profitability";
import type { RiskAssessment } from "@/lib/analysis/risk";
import type { PreScoredCandidate } from "@/lib/analysis/pre-score";
import { logger } from "@/lib/logging/logger";

export interface SaveAnalysisInput {
  item: MercadoLibreItem;
  url: string;
  fingerprint?: ProductFingerprint;
  candidates?: PreScoredCandidate[];
  matches?: Array<{ candidateId: string; result: AIMatchResult }>;
  profitability?: Map<string, ProfitabilityResult>;
  risks?: Map<string, RiskAssessment>;
  classifications?: Map<string, string>;
}

/**
 * Servicio de persistencia del pipeline (TODO §37-§40).
 * Guarda el resultado completo de un análisis en la DB.
 */
export const analysisPersistence = {
  async saveStart(input: { item: MercadoLibreItem; url: string }): Promise<string> {
    const record = await analysisRepository.create({
      sourceItemId: input.item.id?.rawId ?? "",
      sourceUrl: input.url,
      sourceTitle: input.item.title ?? undefined,
      sourcePrice: input.item.price ?? undefined,
      sourceCurrency: input.item.currency ?? undefined,
    });
    logger.info("persistence.analysis_started", { analysisId: record.id });
    return record.id;
  },

  async saveFingerprint(analysisId: string, fingerprint: ProductFingerprint): Promise<void> {
    await analysisRepository.updateStatus(analysisId, "running");
    const supa = (await import("@/lib/db/supabase")).getSupabaseClient();
    await supa
      .from("analyses")
      .update({ fingerprint_json: fingerprint })
      .eq("id", analysisId);
  },

  async saveCandidate(
    analysisId: string,
    candidate: PreScoredCandidate
  ): Promise<string> {
    const supa = (await import("@/lib/db/supabase")).getSupabaseClient();
    const { data, error } = await supa
      .from("candidates")
      .insert({
        analysis_id: analysisId,
        item_id: candidate.item.id?.rawId ?? "",
        title: candidate.item.title ?? null,
        price: candidate.item.price ?? null,
        currency: candidate.item.currency ?? null,
        url: candidate.item.permalink ?? null,
        seller_id: candidate.item.seller?.id ?? null,
        pre_score: candidate.score,
        raw_data_json: candidate.item as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (error) {
      logger.error("persistence.candidate_failed", { analysisId, cause: error.message });
      return "";
    }
    return data.id as string;
  },

  async saveMatch(
    analysisId: string,
    candidateDbId: string,
    result: AIMatchResult
  ): Promise<string> {
    const supa = (await import("@/lib/db/supabase")).getSupabaseClient();
    const { data, error } = await supa
      .from("matches")
      .insert({
        analysis_id: analysisId,
        candidate_id: candidateDbId,
        gemini_result_json: result as unknown as Record<string, unknown>,
        match_type: result.matchType,
        confidence: result.confidence,
        score: result.score,
      })
      .select()
      .single();

    if (error) {
      logger.error("persistence.match_failed", { analysisId, cause: error.message });
      return "";
    }
    return data.id as string;
  },

  async saveOpportunity(
    analysisId: string,
    candidateDbId: string,
    matchId: string,
    profitability: ProfitabilityResult,
    risk: RiskAssessment,
    level: string,
    sourcePrice: number
  ): Promise<void> {
    await opportunityRepository.create({
      analysisId,
      candidateId: candidateDbId,
      matchId,
      salePrice: sourcePrice,
      acquisitionPrice: sourcePrice - profitability.grossDifference,
      grossDifference: profitability.grossDifference,
      estimatedProfit: profitability.estimatedProfit,
      marginPercent: profitability.marginPercent,
      roiPercent: profitability.roiPercent,
      riskLevel: risk.level,
      level,
    });
  },

  async saveComplete(analysisId: string): Promise<void> {
    await analysisRepository.updateStatus(analysisId, "completed");
    logger.info("persistence.analysis_completed", { analysisId });
  },

  async saveFailed(analysisId: string, error: string): Promise<void> {
    await analysisRepository.updateStatus(analysisId, "failed", error);
    logger.error("persistence.analysis_failed", { analysisId, error });
  },
};
