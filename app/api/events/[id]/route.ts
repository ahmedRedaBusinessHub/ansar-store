import { NextResponse, type NextRequest } from "next/server";
import { fetchEventInfo } from "@/lib/event-data";
import { isEventId } from "@/lib/events";
import { getSessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live booking state for one event, with the shopper's own booking when signed in. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isEventId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const info = await fetchEventInfo(id, getSessionToken(request));
    if (!info) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ info }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
