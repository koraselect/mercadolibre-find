import { NextRequest, NextResponse } from "next/server";
import type { MercadoLibreItem, MercadoLibreItemId } from "@/lib/ml/types";
import { findCheaperAlternatives } from "@/lib/analysis/opportunity";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

interface CandidateInput {
  id: string;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  permalink?: string | null;
  sellerId?: string | null;
  thumbnail?: string | null;
}

interface MatchRequest {
  sourceId: string;
  sourcePrice: number | null;
  candidates: CandidateInput[];
}

function candidateToItem(c: CandidateInput): MercadoLibreItem {
  const rawId = c.id.toUpperCase().replace(/-/g, "");
  const siteMatch = rawId.match(/^([A-Z]{3})/);
  const itemId: MercadoLibreItemId = {
    siteId: siteMatch ? siteMatch[1] : "MLV",
    numericId: rawId.replace(/^[A-Z]{3}/, ""),
    rawId,
    kind: "item",
  };

  return {
    id: itemId,
    title: c.title ?? null,
    price: c.price ?? null,
    currency: c.currency ?? null,
    status: "active",
    subStatus: null,
    availableQuantity: null,
    stockBucket: { range: null, minEstimate: null },
    seller: { id: c.sellerId ?? null, nickname: null },
    pictures: c.thumbnail ? [c.thumbnail] : [],
    description: null,
    domainId: null,
    categoryId: null,
    catalogProductId: null,
    attributes: {},
    variations: [],
    permalink: c.permalink ?? null,
    dataSources: ["search"],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * POST /api/opportunity/match
 * Recibe candidates del browser y retorna alternativas mas baratas.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as MatchRequest;

    if (!body.sourceId || !body.candidates?.length) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Faltan sourceId o candidates." },
        { status: 400 }
      );
    }

    const sourceId = body.sourceId.toUpperCase().replace(/-/g, "");
    const siteMatch = sourceId.match(/^([A-Z]{3})/);
    const sourceItem: MercadoLibreItem = {
      id: {
        siteId: siteMatch ? siteMatch[1] : "MLV",
        numericId: sourceId.replace(/^[A-Z]{3}/, ""),
        rawId: sourceId,
        kind: "item",
      },
      title: null,
      price: body.sourcePrice,
      currency: null,
      status: "active",
      subStatus: null,
      availableQuantity: null,
      stockBucket: { range: null, minEstimate: null },
      seller: { id: null, nickname: null },
      pictures: [],
      description: null,
      domainId: null,
      categoryId: null,
      catalogProductId: null,
      attributes: {},
      variations: [],
      permalink: null,
      dataSources: [],
      fetchedAt: new Date().toISOString(),
    };

    const candidates = body.candidates.map(candidateToItem);
    const { sourceId: sId, sourcePrice, alternatives, evaluated } = findCheaperAlternatives(
      sourceItem,
      candidates
    );

    return NextResponse.json(
      {
        ok: true,
        step: "results",
        sourceId: sId,
        sourcePrice,
        evaluated,
        totalCandidates: candidates.length,
        alternatives,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logger.error("api.match.error", { cause: String(err).slice(0, 200) });
    return NextResponse.json(
      { ok: false, error: "INTERNAL", message: "Error al procesar candidatos." },
      { status: 500 }
    );
  }
}
