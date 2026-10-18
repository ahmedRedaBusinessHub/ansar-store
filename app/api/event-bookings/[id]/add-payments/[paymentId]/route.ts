import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstreamFailure, uuid } from "@/app/api/checkout/shared";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail } from "../../../shared";

export const runtime = "nodejs";

const paymentSchema = z.object({
  id: z.string(), status: z.string(), amount: z.number().int().positive(), currency: z.string(),
  entity_type: z.literal("EVENT"), entity_id: z.string(),
});

/** Moyasar form data for an add-tickets payment (created by add-tickets, read back here so a reload works). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; paymentId: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id, paymentId } = await context.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(paymentId).success) return fail(400, "invalid_input");
  try {
    const parsed = paymentSchema.safeParse((await upstream<unknown>(`/api/v2/payments/${paymentId}`, { token })).data);
    if (!parsed.success || parsed.data.entity_id !== id) return fail(404, "not_found");
    // Already paid, failed or refunded: the pay page tells the shopper to start again.
    if (parsed.data.status !== "INITIATED") return fail(409, "order_rejected", { code: "INVALID_STATUS" });
    return NextResponse.json({
      paymentId, givenId: paymentId, amountHalalah: parsed.data.amount, currency: parsed.data.currency,
      description: "تذاكر إضافية لفعالية نادي الأنصار",
      metadata: { payment_id: paymentId, entity_type: "EVENT", entity_id: id },
    }, { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
