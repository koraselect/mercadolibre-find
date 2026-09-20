import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ScrapeResult {
  title: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  url: string;
  itemId: string | null;
}

async function scrapeMLProduct(
  url: string,
  apiKey: string
): Promise<ScrapeResult> {
  const itemId = url.match(/([A-Z]{3})-?(\d{6,})/i)
    ? (url.match(/([A-Z]{3})-?(\d{6,})/i)![1].toUpperCase() + url.match(/([A-Z]{3})-?(\d{6,})/i)![2])
    : null;

  try {
    const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
    const app = new FirecrawlApp({ apiKey });

    const result = await app.scrapeUrl(url, {
      formats: [{
        type: "json",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            price: { type: "number" },
            currency: { type: "string" },
          },
        },
        prompt: "Extract the product title, price, and currency from this MercadoLibre product page. For VES prices, the format is usually US$XX or Bs.XXX.",
      }],
      waitFor: 5000,
    });

    const json = (result as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const extracted = json?.json as Record<string, unknown> | undefined;

    return {
      title: (extracted?.title as string) || "",
      price: typeof extracted?.price === "number" ? extracted.price : null,
      currency: (extracted?.currency as string) || null,
      imageUrl: null,
      url,
      itemId,
    };
  } catch {
    return { title: "", price: null, currency: null, imageUrl: null, url, itemId };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    urls?: string[];
  } | null;

  const urls = body?.urls;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ ok: false, error: "urls array required" }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
  }

  // Scrape in batches of 3 to respect rate limits
  const results: ScrapeResult[] = [];
  for (let i = 0; i < urls.length; i += 3) {
    const batch = urls.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map((url) => scrapeMLProduct(url, apiKey))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
    // Small delay between batches
    if (i + 3 < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return NextResponse.json(
    { ok: true, results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
