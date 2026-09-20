import { NextRequest, NextResponse } from "next/server";
import { parseMeliInput } from "@/lib/ml/urls";
import { resolveItem } from "@/lib/ml/resolve";
import { buildProductDigest } from "@/lib/analysis/normalize";
import { buildFallbackSearchQueries } from "@/lib/analysis/search-queries";
import { findCheaperAlternatives } from "@/lib/analysis/opportunity";
import { InvalidUrlError, AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

const INPUT_MAX = 400;

interface CandidateInput {
  id: string;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  permalink?: string | null;
  sellerId?: string | null;
}

/**
 * POST /api/opportunity
 * Paso 1: resuelve el source item + genera queries (servidor).
 * El cliente hace la busqueda con esas queries y luego llama
 * POST /api/opportunity/match con los candidates.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const raw = typeof body?.url === "string" ? body.url : "";
  if (!raw || raw.length > INPUT_MAX) {
    return errorResponse(new InvalidUrlError());
  }

  const itemId = parseMeliInput(raw);
  if (!itemId) {
    return errorResponse(new InvalidUrlError());
  }

  try {
    const { item, channel } = await resolveItem(itemId);
    const digest = buildProductDigest(item);

    const queries = buildFallbackSearchQueries({
      title: digest.title,
      brand: digest.brand,
      model: digest.model,
    }).slice(0, 4);

    return NextResponse.json(
      {
        ok: true,
        step: "search",
        sourceId: digest.itemId,
        sourcePrice: digest.price,
        sourceTitle: digest.title,
        sourceBrand: digest.brand,
        sourceModel: digest.model,
        channel,
        queries,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logger.error("api.opportunity.error", { id: itemId.rawId, cause: String(err).slice(0, 200) });
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(
      new AppError("INTERNAL", "Error al resolver el producto.", { status: 500 })
    );
  }
}

function errorResponse(err: AppError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.code, message: err.toUserMessage() },
    { status: err.status }
  );
}
