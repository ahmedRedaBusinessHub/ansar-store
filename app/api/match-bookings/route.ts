import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { bookingUpstream, MAX_TICKETS_PER_MATCH, toBookingCreated } from "@/lib/match-booking";
import { isMatchId, toMatchSection, type MatchSection } from "@/lib/matches";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream, upstreamBody } from "@/lib/upstream";
import { bookingFailure, bookingIpLimiter, fail, readBody } from "./shared";

export const runtime = "nodejs";

const id = z.string().refine(isMatchId);
const schema = z.object({ matchId: id, sectionId: id, quantity: z.number().int().min(1).max(MAX_TICKETS_PER_MATCH) });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  const { matchId, sectionId, quantity } = parsed.data;

  const clientIp = clientIpFrom(request.headers);
  if (clientIp && bookingIpLimiter.hit(clientIp)) return fail(429, "rate_limited");

  try {
    // The section's kind and price come from web-api, never from the browser.
    const { data } = await upstream<unknown[]>(`/api/v2/matches/${matchId}/sections`);
    const section = (Array.isArray(data) ? data : [])
      .map(toMatchSection)
      .find((candidate): candidate is MatchSection => candidate !== null && candidate.id === sectionId);
    if (!section) return fail(404, "not_found");
    if (section.price === null) return fail(422, "booking_rejected", { code: "SECTION_NOT_PRICED" });

    const { path, body } = bookingUpstream(section.kind, matchId, sectionId, quantity);
    const created = toBookingCreated(section.kind, await upstreamBody<unknown>(path, { method: "POST", token, body, clientIp }), section.price === 0);
    if (!created) return fail(503, "upstream_unavailable");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return bookingFailure(error);
  }
}
