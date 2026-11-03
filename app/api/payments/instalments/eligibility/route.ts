import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { instalmentEntity } from "@/lib/tamara";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, tokenOrNull, upstreamFailure } from "../../../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const amountSchema = z.coerce.number().int().positive().max(100_000_000);
const emailSchema = z.string().trim().email().max(254).optional();

const eligibilitySchema = z.object({
  available: z.boolean(),
  instalments: z.number().int().positive().optional(),
  instalment_amount: z.number().int().positive().optional(),
});
const unavailable = { available: false, instalments: null, instalmentAmountHalalah: null };

const tabbyEligibilitySchema = z.object({
  available: z.boolean(),
  reason: z.enum(["UNAVAILABLE", "NEEDS_EMAIL", "REJECTED"]).nullable(),
  rejection_reason: z.string().nullable(),
  instalments: z.number().nullable(),
  instalment_amount: z.number().nullable(),
});
const tabbyUnavailable = { available: false, reason: "UNAVAILABLE", rejectionReason: null, instalments: null, instalmentAmountHalalah: null };

// Tamara & Tabby eligibility is advisory: any upstream problem just hides the option (never an error page).
// Exactly one of ?orderId= (store order), ?passId= (season pass), ?subscriptionId= (event booking), or ?bookingId= (match booking).
export async function GET(request: NextRequest) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const params = request.nextUrl.searchParams;
  const entity = instalmentEntity({
    orderId: params.get("orderId") ?? undefined,
    passId: params.get("passId") ?? undefined,
    subscriptionId: params.get("subscriptionId") ?? undefined,
    bookingId: params.get("bookingId") ?? undefined,
  });
  const amount = amountSchema.safeParse(params.get("amount"));
  if (!entity || !amount.success) return fail(400, "invalid_input");

  const provider = params.get("provider") === "tabby" ? "tabby" : "tamara";
  let email: string | undefined;
  if (provider === "tabby") {
    const emailParsed = emailSchema.safeParse(params.get("email") ?? undefined);
    if (!emailParsed.success) return fail(400, "invalid_input");
    email = emailParsed.data;
  }

  const queryParams: Record<string, string> = {
    entity_type: entity.type,
    entity_id: entity.id,
    amount: String(amount.data),
    currency: "SAR",
  };
  if (provider === "tabby") {
    queryParams.provider = "TABBY";
    queryParams.locale = "ar";
    if (email) queryParams.email = email;
  }
  const query = new URLSearchParams(queryParams);

  try {
    const { data } = await upstream<unknown>(`/api/v2/payments/instalments/eligibility?${query}`, { token });
    if (provider === "tabby") {
      const result = tabbyEligibilitySchema.safeParse(data);
      if (!result.success) return NextResponse.json(tabbyUnavailable);
      return NextResponse.json({
        available: result.data.available,
        reason: result.data.reason,
        rejectionReason: result.data.rejection_reason,
        instalments: result.data.instalments,
        instalmentAmountHalalah: result.data.instalment_amount,
      });
    }
    const result = eligibilitySchema.safeParse(data);
    if (!result.success || !result.data.available || !result.data.instalments) return NextResponse.json(unavailable);
    const instalments = result.data.instalments;
    return NextResponse.json({
      available: true,
      instalments,
      instalmentAmountHalalah: result.data.instalment_amount ?? Math.round(amount.data / instalments),
    });
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 401) return upstreamFailure(error);
    return NextResponse.json(provider === "tabby" ? tabbyUnavailable : unavailable);
  }
}
