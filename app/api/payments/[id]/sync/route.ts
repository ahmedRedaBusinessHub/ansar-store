import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail, paymentStateSchema, readBody, tokenOrNull, upstreamFailure, uuid } from "../../../checkout/shared";

export const runtime = "nodejs";
// Moyasar ids are UUID-like; anything else is refused before reaching web-api.
const schema = z.object({ providerPaymentId: z.string().regex(/^[A-Za-z0-9_-]{1,255}$/).optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  const parsed = schema.safeParse(await readBody(request));
  if (!uuid.safeParse(id).success || !parsed.success) return fail(400, "invalid_input");
  try {
    const { data } = await upstream<unknown>(`/api/v2/payments/${id}/sync`, {
      method: "POST", token,
      body: parsed.data.providerPaymentId ? { provider_payment_id: parsed.data.providerPaymentId } : {},
    });
    const state = paymentStateSchema.parse(data);
    return NextResponse.json({ paymentId: id, status: state.status, orderId: state.entity_id });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(404, "not_found");
    return upstreamFailure(error);
  }
}
