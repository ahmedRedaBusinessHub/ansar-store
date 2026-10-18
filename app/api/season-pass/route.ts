import { NextResponse } from "next/server";
import { fetchSeasonPassOffer } from "@/lib/season-pass-data";
import { fail } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current season and its tiers, always fresh (availability changes by the minute). Public. */
export async function GET() {
  try {
    const offer = await fetchSeasonPassOffer();
    return NextResponse.json({ offer }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail(503, "upstream_unavailable");
  }
}
