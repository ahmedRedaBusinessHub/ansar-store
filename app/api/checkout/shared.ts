import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fetchProducts } from "@/lib/catalog";
import { cartKey, cartTotals, normalizeCart } from "@/lib/cart";
import { clearSessionCookie, getSessionToken } from "@/lib/session";
import { upstream, UpstreamError } from "@/lib/upstream";
import type { CartItem, CheckoutResult } from "@/lib/types";

export const uuid = z.string().uuid();
export const money = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().finite().min(0))
  .transform((value) => Math.round(value * 100) / 100);

export const itemsSchema = z.array(z.object({
  id: uuid,
  optionIds: z.array(z.string().min(1).max(64)).max(10),
  quantity: z.number().int().min(1).max(10),
})).min(1).max(30);

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function readBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

export function tokenOrNull(request: NextRequest): string | null {
  return getSessionToken(request);
}

export function upstreamFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) {
      const response = fail(401, "unauthenticated");
      clearSessionCookie(response);
      return response;
    }
    if (error.status === 403 || error.status === 404) return fail(404, "not_found");
    if (error.status === 429) return fail(429, "rate_limited");
    if (error.status === 409) return fail(409, "order_rejected", { code: error.code });
    if (error.status >= 400 && error.status < 500) return fail(422, "order_rejected", { code: error.code });
  }
  return fail(503, "upstream_unavailable");
}

const signature = (items: CartItem[]) => items.map((item) => `${cartKey({ id: item.id, optionIds: [...item.optionIds].sort() })}x${item.quantity}`).sort().join(";");

/** Re-validates the browser cart against the live catalog. Returns null when anything differs. */
export async function priceCart(items: CartItem[]): Promise<{ items: CartItem[]; subtotal: number } | null> {
  const products = await fetchProducts();
  const normalized = normalizeCart(items, products);
  if (normalized.length === 0 || signature(normalized) !== signature(items)) return null;
  return { items: normalized, subtotal: cartTotals(normalized, products, { fee: 0, freeAbove: 0 }).subtotal };
}

/** web-api order line for a re-validated cart item (orders and discount preview take the same shape). */
export function toUpstreamItem(item: CartItem) {
  return { item_id: item.id, quantity: item.quantity, ...(item.optionIds.length > 0 ? { selected_option_ids: item.optionIds } : {}) };
}

const intentSchema = z.object({
  payment_id: z.string(), given_id: z.string(), amount: z.number().int().positive(), currency: z.string(), description: z.string(),
  sdk_config: z.object({ metadata: z.object({ payment_id: z.string(), entity_type: z.string(), entity_id: z.string() }) }),
});

export async function createIntent(token: string, orderId: string): Promise<NonNullable<CheckoutResult["payment"]>> {
  const { data } = await upstream<unknown>("/api/v2/payments/create-intent", { method: "POST", token, body: { entity_type: "ORDER", entity_id: orderId } });
  const intent = intentSchema.parse(data);
  return { paymentId: intent.payment_id, givenId: intent.given_id, amountHalalah: intent.amount, currency: intent.currency, description: intent.description, metadata: intent.sdk_config.metadata };
}

export const paymentStateSchema = z.object({
  status: z.enum(["INITIATED", "PENDING", "PAID", "FAILED", "REFUNDED", "REFUNDING"]),
  entity_type: z.literal("ORDER"),
  entity_id: z.string(),
});
