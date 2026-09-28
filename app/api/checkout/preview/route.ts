import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail, itemsSchema, money, priceCart, readBody, tokenOrNull, toUpstreamItem, upstreamFailure, uuid } from "../shared";

export const runtime = "nodejs";
const schema = z.object({
  items: itemsSchema,
  couponCode: z.string().trim().min(1).max(64).optional(),
  pointsToSpend: z.number().int().positive().max(1_000_000).optional(),
  shippingZoneId: uuid.optional(),
});
const previewSchema = z.object({
  original_total: money, total_discount: money, final_total: money,
  coupon_valid: z.boolean().nullish(), coupon_message: z.string().nullish(),
  points_spent: z.number().nullish(), points_error: z.string().nullish(),
  shipping_enabled: z.boolean().optional(), shipping_required: z.boolean().optional(),
  shipping_fee: money.optional(), free_shipping_applied: z.boolean().optional(),
  amount_to_free_shipping: money.nullish(), grand_total: money.optional(),
});

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  const input = parsed.data;
  try {
    const priced = await priceCart(input.items);
    if (!priced) return fail(409, "order_rejected", { code: "CART_CHANGED" });
    const { data } = await upstream<unknown>("/api/v2/orders/discount-preview", {
      method: "POST",
      token,
      body: {
        order_type: "STORE_ORDER",
        // Items, not a subtotal: web-api prices them itself (options included) and
        // accepts a zero total, which original_total (positive only) would reject.
        items: priced.items.map(toUpstreamItem),
        ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
        ...(input.pointsToSpend ? { points_to_spend: input.pointsToSpend } : {}),
        ...(input.shippingZoneId ? { shipping_zone_id: input.shippingZoneId } : {}),
      },
    });
    const p = previewSchema.parse(data);
    return NextResponse.json({
      originalTotal: p.original_total, totalDiscount: p.total_discount, finalTotal: p.final_total,
      couponValid: p.coupon_valid ?? true, couponMessage: p.coupon_message ?? null,
      pointsSpent: p.points_spent ?? 0, pointsError: p.points_error ?? null,
      shippingEnabled: p.shipping_enabled ?? false, shippingRequired: p.shipping_required ?? false,
      shippingFee: p.shipping_fee ?? 0, freeShippingApplied: p.free_shipping_applied ?? false,
      amountToFreeShipping: p.amount_to_free_shipping ?? null, grandTotal: p.grand_total ?? p.final_total,
    });
  } catch (error) {
    return upstreamFailure(error);
  }
}
