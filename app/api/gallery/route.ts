import { NextResponse } from "next/server";
import { fetchMediaPage } from "@/lib/media-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Latest six gallery items (photos and videos) for the home page strip. */
export async function GET() {
  try {
    const { items } = await fetchMediaPage("all", { perPage: 6 });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
