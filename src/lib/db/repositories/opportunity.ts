import { getSupabaseClient } from "@/lib/db/supabase";
import { logger } from "@/lib/logging/logger";

export interface OpportunityRecord {
  id: string;
  analysisId: string;
  candidateId: string;
  matchId: string | null;
  salePrice: number | null;
  acquisitionPrice: number | null;
  grossDifference: number | null;
  estimatedProfit: number | null;
  marginPercent: number | null;
  roiPercent: number | null;
  riskLevel: string | null;
  level: string | null;
  status: string;
  createdAt: string;
}

export interface CreateOpportunityInput {
  analysisId: string;
  candidateId: string;
  matchId?: string;
  salePrice: number;
  acquisitionPrice: number;
  grossDifference: number;
  estimatedProfit: number;
  marginPercent: number;
  roiPercent: number;
  riskLevel: string;
  level: string;
}

/**
 * Repository de oportunidades (TODO §40).
 * CRUD para la tabla `opportunities`.
 */
export const opportunityRepository = {
  async create(input: CreateOpportunityInput): Promise<OpportunityRecord> {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("opportunities")
      .insert({
        analysis_id: input.analysisId,
        candidate_id: input.candidateId,
        match_id: input.matchId ?? null,
        sale_price: input.salePrice,
        acquisition_price: input.acquisitionPrice,
        gross_difference: input.grossDifference,
        estimated_profit: input.estimatedProfit,
        margin_percent: input.marginPercent,
        roi_percent: input.roiPercent,
        risk_level: input.riskLevel,
        level: input.level,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      logger.error("db.opportunity.create_failed", { cause: error.message });
      throw error;
    }

    return mapOpportunity(data);
  },

  async listByAnalysis(analysisId: string): Promise<OpportunityRecord[]> {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("opportunities")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("estimated_profit", { ascending: false });

    if (error || !data) return [];
    return data.map(mapOpportunity);
  },

  async listRecent(opts: { limit?: number } = {}): Promise<OpportunityRecord[]> {
    const supa = getSupabaseClient();
    const limit = opts.limit ?? 20;

    const { data, error } = await supa
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(mapOpportunity);
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const supa = getSupabaseClient();
    const { error } = await supa.from("opportunities").update({ status }).eq("id", id);
    if (error) {
      logger.error("db.opportunity.update_failed", { id, cause: error.message });
      throw error;
    }
  },
};

function mapOpportunity(row: Record<string, unknown>): OpportunityRecord {
  return {
    id: row.id as string,
    analysisId: row.analysis_id as string,
    candidateId: row.candidate_id as string,
    matchId: row.match_id as string | null,
    salePrice: row.sale_price as number | null,
    acquisitionPrice: row.acquisition_price as number | null,
    grossDifference: row.gross_difference as number | null,
    estimatedProfit: row.estimated_profit as number | null,
    marginPercent: row.margin_percent as number | null,
    roiPercent: row.roi_percent as number | null,
    riskLevel: row.risk_level as string | null,
    level: row.level as string | null,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}
