import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fail, matchPaymentStateSchema, tokenOrNull, upstreamFailure, uuid } from "@/app/api/checkout/shared";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return fail(400, "invalid_input");
  try {
    const state = matchPaymentStateSchema.parse((await upstream<unknown>(`/api/v2/payments/${id}`, { token })).data);
    return NextResponse.json({ paymentId: id, status: state.status, bookingId: state.entity_id });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(404, "not_found");
    return upstreamFailure(error);
  }
}
