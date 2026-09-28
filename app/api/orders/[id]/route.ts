import { NextResponse, type NextRequest } from "next/server";
import { toOrderSummary } from "@/lib/adapter";
import { upstream } from "@/lib/upstream";
import { fail, tokenOrNull, upstreamFailure, uuid } from "../../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return fail(400, "invalid_input");
  try {
    const order = toOrderSummary((await upstream<unknown>(`/api/v2/orders/${id}`, { token })).data);
    return order ? NextResponse.json(order) : fail(404, "not_found");
  } catch (error) {
    return upstreamFailure(error);
  }
}
