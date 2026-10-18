import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/season-pass";
import { fetchCurrentSeason } from "@/lib/season-pass-data";
import { toSectionSeats } from "@/lib/seat-map";
import { getSessionToken } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail, readFailure } from "../../../../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seats of one section, with season availability. Loaded only when the buyer opens the section. */
export async function GET(request: NextRequest, context: { params: Promise<{ tierId: string; sectionId: string }> }) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { tierId, sectionId } = await context.params;
  if (!isUuid(tierId) || !isUuid(sectionId)) return fail(400, "invalid_input");
  try {
    const season = await fetchCurrentSeason();
    if (!season) return fail(404, "not_found");
    const { data } = await upstream<unknown>(`/api/v2/seasons/${season.id}/tiers/${tierId}/sections/${sectionId}/seats`, { token });
    return NextResponse.json({ seats: toSectionSeats(data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return readFailure(error);
  }
}
