import { NextRequest, NextResponse } from "next/server";
import { analysisRepository } from "@/lib/db/repositories/analysis";
import { opportunityRepository } from "@/lib/db/repositories/opportunity";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/history - Lista análisis recientes con sus oportunidades.
 * GET /api/history?id=xxx - Detalle de un análisis específico.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("id");

  try {
    if (id) {
      const analysis = await analysisRepository.getById(id);
      if (!analysis) {
        return NextResponse.json(
          { ok: false, error: "NOT_FOUND", message: "Analisis no encontrado." },
          { status: 404 }
        );
      }
      const opportunities = await opportunityRepository.listByAnalysis(id);
      return NextResponse.json({ ok: true, analysis, opportunities });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);

    const analyses = await analysisRepository.list({ limit, offset });
    const total = await analysisRepository.count();

    return NextResponse.json({ ok: true, analyses, total, limit, offset });
  } catch (err) {
    logger.error("api.history.error", { cause: String(err).slice(0, 200) });
    if (err instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.toUserMessage() },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL", message: "Error al obtener historial." },
      { status: 500 }
    );
  }
}
