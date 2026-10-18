import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/season-pass";
import { fetchCurrentSeason } from "@/lib/season-pass-data";
import { toSeatMap } from "@/lib/seat-map";
import { getSessionToken } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail, readFailure } from "../../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stadium overview for a SEAT tier of the current season. web-api requires a session for it. */
export async function GET(request: NextRequest, context: { params: Promise<{ tierId: string }> }) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { tierId } = await context.params;
  if (!isUuid(tierId)) return fail(400, "invalid_input");
  try {
    const season = await fetchCurrentSeason();
    if (!season) return fail(404, "not_found");
    const { data } = await upstream<unknown>(`/api/v2/seasons/${season.id}/tiers/${tierId}/seat-map`, { token });
    const map = toSeatMap(data);
    if (!map) return fail(503, "upstream_unavailable");
    return NextResponse.json({ map }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return readFailure(error);
  }
}
