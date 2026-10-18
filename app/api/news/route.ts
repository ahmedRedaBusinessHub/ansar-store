import { NextResponse } from "next/server";
import { toNewsCard } from "@/lib/news";
import { fetchNewsPage } from "@/lib/news-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Latest three news cards for the home page strip. */
export async function GET() {
  try {
    const { items } = await fetchNewsPage(1, { perPage: 3 });
    return NextResponse.json({ news: items.map(toNewsCard) }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
