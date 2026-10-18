import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { fetchEventInfo } from "@/lib/event-data";
import { isEventId, MAX_TICKETS_PER_EVENT_BOOKING } from "@/lib/events";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { readBody } from "@/app/api/checkout/shared";
import { eventBookingIpLimiter, eventFailure, fail } from "./shared";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().refine(isEventId),
  quantity: z.number().int().min(1).max(MAX_TICKETS_PER_EVENT_BOOKING),
});
const createdSchema = z.object({
  id: z.string(),
  status: z.enum(["CONFIRMED", "PENDING_PAYMENT"]),
  hold_expires_at: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  const { eventId, quantity } = parsed.data;

  const clientIp = clientIpFrom(request.headers);
  if (clientIp && eventBookingIpLimiter.hit(clientIp)) return fail(429, "rate_limited");

  try {
    // Bookability comes from web-api, never from the browser.
    const info = await fetchEventInfo(eventId, token);
    if (!info) return fail(404, "not_found");
    if (info.reason === "EXTERNAL") return fail(422, "booking_rejected", { code: "EXTERNAL_BOOKING_ONLY" });
    if (info.reason === "BOOKED") return fail(409, "booking_rejected", { code: "ALREADY_SUBSCRIBED" });
    if (info.reason === "PAST") return fail(422, "booking_rejected", { code: "EVENT_PAST" });

    const { data } = await upstream<unknown>(`/api/v2/events/${eventId}/subscribe`, {
      method: "POST", token, clientIp, body: { quantity },
    });
    const created = createdSchema.safeParse(data);
    if (!created.success) return fail(503, "upstream_unavailable");
    return NextResponse.json({
      subscriptionId: created.data.id,
      status: created.data.status,
      holdExpiresAt: created.data.hold_expires_at ?? null,
    }, { status: 201 });
  } catch (error) {
    return eventFailure(error);
  }
}
