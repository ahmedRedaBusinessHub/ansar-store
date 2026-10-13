import { NextResponse, type NextRequest } from "next/server";
import { fetchMatchSections } from "@/lib/match-data";
import { isMatchId } from "@/lib/matches";
import { UpstreamError } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isMatchId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    return NextResponse.json({ sections: await fetchMatchSections(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
