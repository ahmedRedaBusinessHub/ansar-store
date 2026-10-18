import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { instalmentEntity } from "@/lib/tamara";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, tokenOrNull, upstreamFailure } from "../../../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const amountSchema = z.coerce.number().int().positive().max(100_000_000);
const eligibilitySchema = z.object({
  available: z.boolean(),
  instalments: z.number().int().positive().optional(),
  instalment_amount: z.number().int().positive().optional(),
});
const unavailable = { available: false, instalments: null, instalmentAmountHalalah: null };

// Tamara eligibility is advisory: any upstream problem just hides the option (never an error page).
// Exactly one of ?orderId= (store order), ?passId= (season pass), or ?subscriptionId= (event booking).
export async function GET(request: NextRequest) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const params = request.nextUrl.searchParams;
  const entity = instalmentEntity({
    orderId: params.get("orderId") ?? undefined,
    passId: params.get("passId") ?? undefined,
    subscriptionId: params.get("subscriptionId") ?? undefined,
  });
  const amount = amountSchema.safeParse(params.get("amount"));
  if (!entity || !amount.success) return fail(400, "invalid_input");
  const query = new URLSearchParams({ entity_type: entity.type, entity_id: entity.id, amount: String(amount.data), currency: "SAR" });
  try {
    const { data } = await upstream<unknown>(`/api/v2/payments/instalments/eligibility?${query}`, { token });
    const result = eligibilitySchema.safeParse(data);
    if (!result.success || !result.data.available || !result.data.instalments) return NextResponse.json(unavailable);
    const instalments = result.data.instalments;
    return NextResponse.json({ available: true, instalments,
      instalmentAmountHalalah: result.data.instalment_amount ?? Math.round(amount.data / instalments) });
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 401) return upstreamFailure(error);
    return NextResponse.json(unavailable);
  }
}
