import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstream } from "@/lib/upstream";
import { fail, paymentStateSchema, tokenOrNull, upstreamFailure, uuid } from "../../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return fail(400, "invalid_input");
  try {
    const state = paymentStateSchema.parse((await upstream<unknown>(`/api/v2/payments/${id}`, { token })).data);
    return NextResponse.json({ paymentId: id, status: state.status, orderId: state.entity_id });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(404, "not_found");
    return upstreamFailure(error);
  }
}
