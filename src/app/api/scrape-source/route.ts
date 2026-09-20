import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SourceData {
  title: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  itemId: string | null;
}

function extractItemId(url: string): string | null {
  const m = url.match(/([A-Z]{3})-?(\d{6,})/i);
  return m ? m[1].toUpperCase() + m[2] : null;
}

function extractFromHtml(html: string, url: string): SourceData {
  const itemId = extractItemId(url);

  // Extract title from <title> tag (contains title + price)
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let rawTitle = titleTag?.[1]?.trim() ?? "";
  rawTitle = rawTitle.replace(/\s*-\s*(?:US\$\s*[\d.,]+|(?:USD|\$)\s*[\d.,]+|Bs\.?\s*[\d.,]+)\s*$/i, "").trim();

  // Extract price from meta itemprop="price"
  const priceMeta = html.match(/<meta\s+itemprop="price"\s+content="([^"]+)"/i);
  let price: number | null = null;
  if (priceMeta) {
    price = parseFloat(priceMeta[1]);
    if (isNaN(price)) price = null;
  }

  // Fallback: extract from og:title like "Product - US$ 1.099,99"
  if (price === null && titleTag) {
    const priceMatch = titleTag[1].match(/US\$\s*([\d.,]+)/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
      if (isNaN(price)) price = null;
    }
  }

  // Fallback: extract from aria-label of price element
  if (price === null) {
    const ariaPrice = html.match(/aria-label="(\d+)\s*dólares?\s*con\s*(\d+)\s*centavos?"/i);
    if (ariaPrice) {
      price = parseFloat(`${ariaPrice[1]}.${ariaPrice[2]}`);
    }
  }

  const currency = price !== null ? "USD" : null;

  // Extract image from og:image
  const ogImage = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+(?:property|name)="og:image"/i);
  let imageUrl = ogImage?.[1] ?? null;

  // Fallback: extract from first variation thumbnail
  if (!imageUrl) {
    const thumbMatch = html.match(/ui-pdp-outside_variations__thumbnails__item__picture[^>]+src="([^"]+)"/i);
    if (thumbMatch) imageUrl = thumbMatch[1];
  }

  // Fallback: extract from figure img
  if (!imageUrl) {
    const figMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src="([^"]+\.webp[^"]*)"/i);
    if (figMatch) imageUrl = figMatch[1];
  }

  return { title: rawTitle || null, price, currency, imageUrl, itemId };
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<SourceData> {
  const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
  const app = new FirecrawlApp({ apiKey });

  const result = await app.scrapeUrl(url, {
    formats: ["markdown"],
    waitFor: 5000,
  });

  const markdown = (result as Record<string, unknown>).markdown as string | undefined;
  const metadata = (result as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
  const html = (result as Record<string, unknown>).html as string | undefined;

  const itemId = extractItemId(url);

  // Try to extract from HTML first (most reliable)
  if (html) {
    const fromHtml = extractFromHtml(html, url);
    if (fromHtml.title || fromHtml.price !== null) return fromHtml;
  }

  // Try to extract from metadata
  let title = (metadata?.title as string) ?? null;
  if (title) {
    title = title.replace(/\s*-\s*(?:US\$\s*[\d.,]+|(?:USD|\$)\s*[\d.,]+|Bs\.?\s*[\d.,]+)\s*$/i, "").trim();
  }

  let price: number | null = null;
  if (metadata?.ogTitle) {
    const priceMatch = (metadata.ogTitle as string).match(/US\$\s*([\d.,]+)/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
    }
  }

  // Extract from markdown as last resort
  if (price === null && markdown) {
    const pricePatterns = [
      /US\$\s*([\d.,]+)/i,
      /(?:USD|\$)\s*([\d.,]+)/i,
    ];
    for (const p of pricePatterns) {
      const m = markdown.match(p);
      if (m) {
        price = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        if (price > 0 && price < 1000000) break;
        price = null;
      }
    }
  }

  const imageUrl = (metadata?.ogImage as string) ?? null;

  return { title, price, currency: price !== null ? "USD" : null, imageUrl, itemId };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url;

  if (!url) {
    return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
  }

  if (!url.includes("mercadolibre")) {
    return NextResponse.json({ ok: false, error: "URL must be from MercadoLibre" }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
  }

  try {
    const data = await scrapeWithFirecrawl(url, apiKey);

    if (!data.title && data.price === null) {
      return NextResponse.json(
        { ok: false, error: "No se pudieron extraer datos de la página" },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: `Error: ${msg}` }, { status: 500 });
  }
}
