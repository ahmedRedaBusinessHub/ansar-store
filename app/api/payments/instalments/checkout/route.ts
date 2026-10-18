import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { instalmentEntity, isTamaraCheckoutUrl } from "@/lib/tamara";
import { upstream } from "@/lib/upstream";
import { fail, readBody, tokenOrNull, upstreamFailure, uuid } from "../../../checkout/shared";

export const runtime = "nodejs";
// Exactly one of orderId (store order) / passId (season pass) / subscriptionId (event booking); instalmentEntity enforces it.
const schema = z.object({
  orderId: z.string().optional(),
  passId: z.string().optional(),
  subscriptionId: z.string().optional(),
  amount: z.number().int().positive().max(100_000_000),
});
const sessionSchema = z.object({ payment_id: uuid, checkout_url: z.string() });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  const entity = parsed.success ? instalmentEntity(parsed.data) : null;
  if (!parsed.success || !entity) return fail(400, "invalid_input");
  try {
    // web-api re-checks ownership and that amount equals the server price (409 AMOUNT_MISMATCH otherwise).
    const { data } = await upstream<unknown>("/api/v2/payments/instalments/checkout", {
      method: "POST", token,
      body: { entity_type: entity.type, entity_id: entity.id, amount: parsed.data.amount, currency: "SAR", locale: "ar", return_channel: "WEB" },
    });
    const session = sessionSchema.safeParse(data);
    if (!session.success || !isTamaraCheckoutUrl(session.data.checkout_url)) return fail(503, "upstream_unavailable");
    return NextResponse.json({ paymentId: session.data.payment_id, checkoutUrl: session.data.checkout_url }, { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
