import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { query?: unknown; maxResults?: number } | null;
  const query = typeof body?.query === "string" ? body.query : "";
  const maxResults = typeof body?.maxResults === "number" ? body.maxResults : 10;

  if (!query) {
    return NextResponse.json({ ok: false, error: "Query required" }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
    const app = new FirecrawlApp({ apiKey });

    const results = await app.search(query, { limit: maxResults });
    const web = (results as Record<string, unknown>).web as
      | Array<{ title?: string; url?: string; description?: string }>
      | undefined;

    if (!web || !Array.isArray(web)) {
      return NextResponse.json({ ok: true, query, totalResults: 0, results: [] });
    }

    // Filter for MercadoLibre results only
    const mlResults = web.filter((r) => r.url?.includes("mercadolibre.com"));

    return NextResponse.json(
      {
        ok: true,
        query,
        totalResults: mlResults.length,
        results: mlResults.map((r) => ({
          title: r.title || "",
          url: r.url || "",
          snippet: (r.description || "").slice(0, 300),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err).slice(0, 200) },
      { status: 500 }
    );
  }
}
