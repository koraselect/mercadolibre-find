/**
 * Tipos de dominio del análisis de oportunidades (TODO §22, §28).
 * Independientes de React y de la UI: el pipeline los usa y la UI los muestra.
 */

export const ANALYSIS_STAGES = [
  "queued",
  "fetching_source",
  "fingerprinting",
  "searching",
  "filtering",
  "matching",
  "calculating",
  "completed",
  "partial",
  "failed",
] as const;

/** Estado/progreso de un análisis del pipeline. */
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export type AnalysisStatus = AnalysisStage;

/** Error tipado devuelto por el pipeline, con texto legible para la UI. */
export interface AnalysisErrorInfo {
  code: string;
  message: string;
  stage?: AnalysisStage;
  retryable?: boolean;
}

/** Entrada mínima de un análisis: la URL de la publicación de origen. */
export interface AnalysisRequest {
  url: string;
}

/** Output que expone el progreso de un análisis en ejecución. */
export interface AnalysisProgress {
  status: AnalysisStatus;
  /** Id del ítem de origen cuando ya se resolvió. */
  itemId?: string;
  error?: AnalysisErrorInfo;
}

export const ANALYSIS_STAGE_ORDER: Record<AnalysisStage, number> = {
  queued: 0,
  fetching_source: 1,
  fingerprinting: 2,
  searching: 3,
  filtering: 4,
  matching: 5,
  calculating: 6,
  completed: 7,
  partial: 7,
  failed: 7,
};

/** True si `stage` ocurre antes que `other` en el pipeline. */
export function isStageBefore(stage: AnalysisStage, other: AnalysisStage): boolean {
  return ANALYSIS_STAGE_ORDER[stage] < ANALYSIS_STAGE_ORDER[other];
}