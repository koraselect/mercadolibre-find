import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    queries?: unknown[];
    sourceKeywords?: unknown;
    maxResults?: number;
  } | null;

  const queries = Array.isArray(body?.queries)
    ? body!.queries.filter((q): q is string => typeof q === "string" && q.length > 0)
    : [];
  const sourceKeywords = typeof body?.sourceKeywords === "string" ? body.sourceKeywords : "";
  const maxResults = typeof body?.maxResults === "number" ? body.maxResults : 15;

  if (queries.length === 0) {
    return NextResponse.json({ ok: false, error: "queries array required" }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
    const app = new FirecrawlApp({ apiKey });

    const allResults: Array<{ title: string; url: string; snippet: string }> = [];
    const seen = new Set<string>();

    for (const q of queries) {
      try {
        const results = await app.search(q, { limit: 10 });
        const web = (results as Record<string, unknown>).web as
          | Array<{ title?: string; url?: string; description?: string }>
          | undefined;

        if (web && Array.isArray(web)) {
          for (const r of web) {
            const url = r.url || "";
            // Only ML product listings
            if (!url.includes("articulo.mercadolibre.com") || !url.includes("_JM")) continue;
            if (seen.has(url)) continue;
            seen.add(url);

            allResults.push({
              title: r.title || "",
              url,
              snippet: (r.description || "").slice(0, 300),
            });
          }
        }
      } catch {
        // Skip failed queries (rate limit, etc)
      }
    }

    // Relevance scoring
    const sourceWords = sourceKeywords
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 3);

    const scored = allResults.map((r) => {
      const text = ((r.title || "") + " " + (r.snippet || "")).toLowerCase();
      let relevance = 1;
      for (const word of sourceWords) {
        if (text.includes(word)) relevance += 1;
      }
      // Penalize unrelated brands
      const brandMap: Record<string, string[]> = {
        xiaomi: ["iphone", "samsung", "galaxy", "huawei", "motorola", "realme", "oppo", "apple"],
        iphone: ["xiaomi", "redmi", "samsung", "galaxy", "huawei", "motorola", "realme"],
        samsung: ["iphone", "xiaomi", "redmi", "huawei", "motorola", "apple"],
        huawei: ["iphone", "xiaomi", "samsung", "galaxy", "motorola", "apple"],
        playstation: ["xbox", "nintendo", "switch"],
        xbox: ["playstation", "ps5", "nintendo", "switch"],
      };
      for (const [brand, others] of Object.entries(brandMap)) {
        if (sourceWords.includes(brand)) {
          for (const b of others) {
            if (text.includes(b)) {
              relevance -= 3;
              break;
            }
          }
          break;
        }
      }

      return { ...r, relevance };
    });

    const filtered = scored
      .filter((r) => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    return NextResponse.json(
      {
        ok: true,
        totalResults: filtered.length,
        results: filtered.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
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
