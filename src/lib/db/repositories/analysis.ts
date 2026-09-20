import { getSupabaseClient } from "@/lib/db/supabase";
import { logger } from "@/lib/logging/logger";

export interface AnalysisRecord {
  id: string;
  sourceItemId: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourcePrice: number | null;
  sourceCurrency: string | null;
  fingerprintJson: Record<string, unknown> | null;
  status: "pending" | "running" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateAnalysisInput {
  sourceItemId: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourcePrice?: number;
  sourceCurrency?: string;
  fingerprintJson?: Record<string, unknown>;
}

/**
 * Repository de análisis (TODO §37).
 * CRUD para la tabla `analyses`.
 */
export const analysisRepository = {
  async create(input: CreateAnalysisInput): Promise<AnalysisRecord> {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("analyses")
      .insert({
        source_item_id: input.sourceItemId,
        source_url: input.sourceUrl,
        source_title: input.sourceTitle ?? null,
        source_price: input.sourcePrice ?? null,
        source_currency: input.sourceCurrency ?? "USD",
        fingerprint_json: input.fingerprintJson ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("db.analysis.create_failed", { cause: error.message });
      throw error;
    }

    return mapAnalysis(data);
  },

  async updateStatus(
    id: string,
    status: AnalysisRecord["status"],
    errorMessage?: string
  ): Promise<void> {
    const supa = getSupabaseClient();
    const update: Record<string, unknown> = { status };
    if (status === "completed") update.completed_at = new Date().toISOString();
    if (errorMessage) update.error_message = errorMessage;

    const { error } = await supa.from("analyses").update(update).eq("id", id);
    if (error) {
      logger.error("db.analysis.update_failed", { id, cause: error.message });
      throw error;
    }
  },

  async getById(id: string): Promise<AnalysisRecord | null> {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("analyses")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapAnalysis(data);
  },

  async list(opts: { limit?: number; offset?: number } = {}): Promise<AnalysisRecord[]> {
    const supa = getSupabaseClient();
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    const { data, error } = await supa
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(mapAnalysis);
  },

  async count(): Promise<number> {
    const supa = getSupabaseClient();
    const { count, error } = await supa
      .from("analyses")
      .select("*", { count: "exact", head: true });

    if (error) return 0;
    return count ?? 0;
  },
};

function mapAnalysis(row: Record<string, unknown>): AnalysisRecord {
  return {
    id: row.id as string,
    sourceItemId: row.source_item_id as string,
    sourceUrl: row.source_url as string,
    sourceTitle: row.source_title as string | null,
    sourcePrice: row.source_price as number | null,
    sourceCurrency: row.source_currency as string | null,
    fingerprintJson: row.fingerprint_json as Record<string, unknown> | null,
    status: row.status as AnalysisRecord["status"],
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
  };
}
