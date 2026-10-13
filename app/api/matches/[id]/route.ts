import { NextResponse, type NextRequest } from "next/server";
import { fetchMatchDetail } from "@/lib/match-data";
import { isMatchId } from "@/lib/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isMatchId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const match = await fetchMatchDetail(id);
    if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ match }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
