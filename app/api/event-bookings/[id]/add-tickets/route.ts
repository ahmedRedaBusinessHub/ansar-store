import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readBody, uuid } from "@/app/api/checkout/shared";
import { clientIpFrom } from "@/lib/client-ip";
import { MAX_TICKETS_PER_EVENT_BOOKING } from "@/lib/events";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { eventBookingIpLimiter, eventFailure, fail } from "../../shared";

export const runtime = "nodejs";

const schema = z.object({ quantity: z.number().int().min(1).max(MAX_TICKETS_PER_EVENT_BOOKING) });
const resultSchema = z.union([
  z.object({ requires_payment: z.literal(false) }),
  z.object({ requires_payment: z.literal(true), payment_id: z.string() }),
]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  const parsed = schema.safeParse(await readBody(request));
  if (!uuid.safeParse(id).success || !parsed.success) return fail(400, "invalid_input");
  const clientIp = clientIpFrom(request.headers);
  if (clientIp && eventBookingIpLimiter.hit(clientIp)) return fail(429, "rate_limited");
  try {
    const { data } = await upstream<unknown>(`/api/v2/events/subscribed/${id}/add-tickets`, {
      method: "POST", token, clientIp, body: { quantity: parsed.data.quantity },
    });
    const result = resultSchema.safeParse(data);
    if (!result.success) return fail(503, "upstream_unavailable");
    return NextResponse.json(result.data.requires_payment
      ? { requiresPayment: true, paymentId: result.data.payment_id }
      : { requiresPayment: false });
  } catch (error) {
    return eventFailure(error);
  }
}
