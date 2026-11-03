import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { isTabbyCheckoutUrl } from "@/lib/tabby";
import { instalmentEntity, isTamaraCheckoutUrl } from "@/lib/tamara";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, readBody, tokenOrNull, upstreamFailure, uuid } from "../../../checkout/shared";

export const runtime = "nodejs";
// Exactly one of orderId (store order) / passId (season pass) / subscriptionId (event booking) / bookingId (match booking); instalmentEntity enforces it.
const schema = z.object({
  orderId: z.string().optional(),
  passId: z.string().optional(),
  subscriptionId: z.string().optional(),
  bookingId: z.string().optional(),
  amount: z.number().int().positive().max(100_000_000),
  provider: z.enum(["tamara", "tabby"]).optional(),
  buyerEmail: z.string().trim().email().max(254).optional(),
});
const sessionSchema = z.object({ payment_id: uuid, checkout_url: z.string() });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  const entity = parsed.success ? instalmentEntity(parsed.data) : null;
  if (!parsed.success || !entity) return fail(400, "invalid_input");

  const isTabby = parsed.data.provider === "tabby";
  try {
    // web-api re-checks ownership and that amount equals the server price (409 AMOUNT_MISMATCH otherwise).
    const upstreamBody: Record<string, unknown> = {
      entity_type: entity.type,
      entity_id: entity.id,
      amount: parsed.data.amount,
      currency: "SAR",
      locale: "ar",
      return_channel: "WEB",
    };
    if (isTabby) {
      upstreamBody.provider = "TABBY";
      if (parsed.data.buyerEmail) upstreamBody.buyer_email = parsed.data.buyerEmail;
    }

    const { data } = await upstream<unknown>("/api/v2/payments/instalments/checkout", {
      method: "POST",
      token,
      body: upstreamBody,
    });
    const session = sessionSchema.safeParse(data);
    const isCheckoutUrl = isTabby ? isTabbyCheckoutUrl : isTamaraCheckoutUrl;
    if (!session.success || !isCheckoutUrl(session.data.checkout_url)) return fail(503, "upstream_unavailable");
    return NextResponse.json({ paymentId: session.data.payment_id, checkoutUrl: session.data.checkout_url }, { status: 201 });
  } catch (error) {
    if (error instanceof UpstreamError && error.code === "INSTALMENTS_REJECTED") {
      const raw = error.details as Record<string, unknown> | undefined;
      const errObj = raw?.error as Record<string, unknown> | undefined;
      const detailsObj = (raw?.details ?? errObj?.details) as Record<string, unknown> | undefined;
      const rejectionReason = (raw?.rejection_reason ?? detailsObj?.rejection_reason ?? "not_available") as string;
      return NextResponse.json({
        error: "order_rejected",
        code: "INSTALMENTS_REJECTED",
        rejectionReason,
      }, { status: 409 });
    }
    return upstreamFailure(error);
  }
}
