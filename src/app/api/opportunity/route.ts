import { NextRequest, NextResponse } from "next/server";
import { parseMeliInput } from "@/lib/ml/urls";
import { resolveItem } from "@/lib/ml/resolve";
import { createMeliHttpClient } from "@/lib/ml/client";
import { searchCandidates } from "@/lib/ml/search";
import { buildProductDigest } from "@/lib/analysis/normalize";
import { buildFallbackSearchQueries } from "@/lib/analysis/search-queries";
import { findCheaperAlternatives } from "@/lib/analysis/opportunity";
import { InvalidUrlError, AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

const INPUT_MAX = 400;
const MAX_QUERIES = 4;
const SEARCH_LIMIT = 10;

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
    }).slice(0, MAX_QUERIES);

    const client = createMeliHttpClient();
    const allCandidates = [];
    for (const q of queries) {
      try {
        const results = await searchCandidates(client, q, { limit: SEARCH_LIMIT });
        allCandidates.push(...results);
      } catch (err) {
        logger.debug("api.opportunity.search_fallback", {
          q: q.slice(0, 80),
          cause: String(err).slice(0, 120),
        });
      }
    }

    const { sourceId, sourcePrice, alternatives, evaluated } = findCheaperAlternatives(
      item,
      allCandidates
    );

    const headers = new Headers();
    headers.set("X-Data-Channel", channel);
    headers.set("Cache-Control", "no-store");

    return NextResponse.json(
      {
        ok: true,
        sourceId,
        sourcePrice,
        channel,
        queries,
        evaluated,
        alternatives,
      },
      { headers }
    );
  } catch (err) {
    logger.error("api.opportunity.error", { id: itemId.rawId, cause: String(err).slice(0, 200) });
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(
      new AppError("INTERNAL", "Error al analizar la oportunidad.", { status: 500 })
    );
  }
}

function errorResponse(err: AppError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.code, message: err.toUserMessage() },
    { status: err.status }
  );
}
