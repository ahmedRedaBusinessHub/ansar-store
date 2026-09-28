import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { createIntent, fail, itemsSchema, money, priceCart, readBody, tokenOrNull, toUpstreamItem, upstreamFailure, uuid } from "./shared";

export const runtime = "nodejs";
const schema = z.object({
  items: itemsSchema,
  deliveryAddress: z.string().trim().min(10).max(500),
  couponCode: z.string().trim().min(1).max(64).optional(),
  pointsToSpend: z.number().int().positive().max(1_000_000).optional(),
  shippingZoneId: uuid.optional(),
  expectedShippingFee: z.number().min(0).max(100_000).optional(),
});
const orderSchema = z.object({ id: z.string(), total_price: money, requires_payment: z.boolean() });

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
    const { data } = await upstream<unknown>("/api/v2/orders", {
      method: "POST",
      token,
      body: {
        items: priced.items.map(toUpstreamItem),
        delivery_address: input.deliveryAddress,
        ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
        ...(input.pointsToSpend ? { points_to_spend: input.pointsToSpend } : {}),
        shipping_zone_id: input.shippingZoneId ?? null,
        ...(input.expectedShippingFee !== undefined ? { expected_shipping_fee: input.expectedShippingFee } : {}),
      },
    });
    const order = orderSchema.parse(data);
    let payment = null;
    if (order.requires_payment) {
      try { payment = await createIntent(token, order.id); } catch { payment = null; } // the pay page retries
    }
    return NextResponse.json({ orderId: order.id, total: order.total_price, requiresPayment: order.requires_payment, payment }, { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
