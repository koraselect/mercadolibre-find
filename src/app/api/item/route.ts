import { NextRequest, NextResponse } from "next/server";
import { parseMeliInput } from "@/lib/ml/urls";
import { resolveItem } from "@/lib/ml/resolve";
import { InvalidUrlError, AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

const INPUT_MAX = 400;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw || raw.length > INPUT_MAX) {
    return errorResponse(new InvalidUrlError());
  }
  const itemId = parseMeliInput(raw);
  if (!itemId) {
    return errorResponse(new InvalidUrlError());
  }
  try {
    const { item, channel } = await resolveItem(itemId);
    const headers = new Headers();
    headers.set("X-Data-Channel", channel);
    headers.set("Cache-Control", "no-store");
    return NextResponse.json({ channel, item }, { headers });
  } catch (err) {
    logger.error("api.item.error", { id: itemId.rawId, cause: String(err).slice(0, 200) });
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(new AppError("INTERNAL", "Error inesperado al obtener el producto.", { status: 500 }));
  }
}

function errorResponse(err: AppError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.code, message: err.toUserMessage() },
    { status: err.status }
  );
}