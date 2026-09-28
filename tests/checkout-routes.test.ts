import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as checkout } from "../app/api/checkout/route";
import { POST as preview } from "../app/api/checkout/preview/route";
import { GET as zones } from "../app/api/shipping-zones/route";
import { POST as intent } from "../app/api/payments/intent/route";
import { POST as sync } from "../app/api/payments/[id]/sync/route";
import { GET as paymentStatus } from "../app/api/payments/[id]/route";
import { GET as orders } from "../app/api/orders/route";
import { resetCatalogCache } from "../lib/catalog";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const SHIRT = "11111111-1111-4111-8111-111111111111";
const ORDER = "44444444-4444-4444-8444-444444444444";
const PAYMENT = "55555555-5555-4555-8555-555555555555";
const ZONE = "77777777-7777-4777-8777-777777777777";
const ADDRESS = "المدينة المنورة، حي قباء، شارع 12";
const storeRow = {
  id: SHIRT, name_ar: "قميص", name_en: "Shirt", description_ar: "", image_url: null, price: "249.00", product_type: "REGULAR",
  created_at: "2026-09-01T00:00:00.000Z", images: [],
  attribute_groups: [{ id: "g-size", name_ar: "المقاس", is_required: true, display_order: 0,
    options: [{ id: "o-xxl", value_ar: "XXL", additional_price: "10.00", is_available: true, display_order: 0 }] }],
};
const orderRow = {
  id: ORDER, payment_status: "UNPAID", fulfillment_status: "PENDING", tracking_number: null, delivery_address: ADDRESS,
  total_price: "543.00", created_at: "2026-09-27T10:00:00.000Z",
  order_items: [{ quantity: 2, unit_price: "259.00", total_price: "518.00", item_name_ar: "قميص", item_image_url: null, attributes: [] }],
};
const intentData = { payment_id: PAYMENT, given_id: "66666666-6666-4666-8666-666666666666", amount: 54300, currency: "SAR", description: `ORDER #${ORDER}`,
  entity_type: "ORDER", entity_id: ORDER, sdk_config: { amount: 54300, currency: "SAR", metadata: { payment_id: PAYMENT, entity_type: "ORDER", entity_id: ORDER } } };
const previewData = {
  original_total: 518, discounts: [], total_discount: 51.8, final_total: 466.2, coupon_valid: true, coupon_message: null,
  discount_cap_applied: false, capped_discount_source: null, max_discount_allowed: 466.2,
  has_physical_items: true, shipping_enabled: true, shipping_required: true,
  shipping_zone: { id: ZONE, name_ar: "المدينة المنورة", name_en: "Madinah", shipping_fee: 25, free_shipping_threshold: 600 },
  shipping_fee: 25, free_shipping_applied: false, free_shipping_threshold: 600, amount_to_free_shipping: 133.8, grand_total: 491.2,
};
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: data instanceof Array ? { page: 1, totalCount: 1, pagesCount: 1 } : null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

type Call = { key: string; body: unknown; auth: string | null };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>).Authorization ?? null });
    const reply = routes[key] ?? (key === "GET /api/v2/store" ? ok([storeRow]) : undefined);
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const req = (path: string, body?: unknown, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const cart = [{ id: SHIRT, optionIds: ["o-xxl"], quantity: 2 }];
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("checkout requires a session and JSON", async () => {
  resetCatalogCache();
  assert.equal((await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS }, ""))).status, 401);
  const plain = new NextRequest("http://shop.test/api/checkout", { method: "POST", headers: { cookie: "ansar_session=tok", "content-type": "text/plain" }, body: "{}" });
  assert.equal((await checkout(plain)).status, 415);
});

test("checkout sends option ids + shipping zone + expected fee, then creates a payment intent", async () => {
  resetCatalogCache();
  const api = mockApi({ "POST /api/v2/orders": ok({ ...orderRow, requires_payment: true }, 201), "POST /api/v2/payments/create-intent": ok(intentData, 201) });
  try {
    const response = await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS, couponCode: "ANSAR10", shippingZoneId: ZONE, expectedShippingFee: 25 }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      orderId: ORDER, total: 543, requiresPayment: true,
      payment: { paymentId: PAYMENT, givenId: intentData.given_id, amountHalalah: 54300, currency: "SAR", description: intentData.description, metadata: intentData.sdk_config.metadata },
    });
    const order = api.calls.find((c) => c.key === "POST /api/v2/orders");
    assert.deepEqual(order?.body, {
      items: [{ item_id: SHIRT, quantity: 2, selected_option_ids: ["o-xxl"] }], delivery_address: ADDRESS,
      coupon_code: "ANSAR10", shipping_zone_id: ZONE, expected_shipping_fee: 25,
    });
    assert.equal(order?.auth, "Bearer tok");
    assert.deepEqual(api.calls.find((c) => c.key === "POST /api/v2/payments/create-intent")?.body, { entity_type: "ORDER", entity_id: ORDER });
  } finally { api.restore(); }
});

test("checkout without shipping sends shipping_zone_id null", async () => {
  resetCatalogCache();
  const api = mockApi({ "POST /api/v2/orders": ok({ ...orderRow, total_price: "0.00", requires_payment: false }, 201) });
  try {
    const body = await (await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS }))).json();
    assert.deepEqual(body, { orderId: ORDER, total: 0, requiresPayment: false, payment: null });
    assert.equal((api.calls.find((c) => c.key === "POST /api/v2/orders")?.body as Record<string, unknown>).shipping_zone_id, null);
  } finally { api.restore(); }
});

test("checkout rejects a stale cart and maps web-api rejections (coupon, shipping)", async () => {
  resetCatalogCache();
  let api = mockApi({ "POST /api/v2/orders": err(400, "COUPON_EXPIRED") });
  try {
    const stale = await checkout(req("/api/checkout", { items: [{ id: SHIRT, optionIds: [], quantity: 1 }], deliveryAddress: ADDRESS }));
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), { error: "order_rejected", code: "CART_CHANGED" });
    const coupon = await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS, couponCode: "OLD" }));
    assert.equal(coupon.status, 422);
    assert.deepEqual(await coupon.json(), { error: "order_rejected", code: "COUPON_EXPIRED" });
  } finally { api.restore(); }
  api = mockApi({ "POST /api/v2/orders": err(409, "SHIPPING_FEE_CHANGED") });
  try {
    const changed = await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS, shippingZoneId: ZONE, expectedShippingFee: 20 }));
    assert.equal(changed.status, 409);
    assert.deepEqual(await changed.json(), { error: "order_rejected", code: "SHIPPING_FEE_CHANGED" });
  } finally { api.restore(); }
});

test("expired session at web-api → 401 unauthenticated and the cookie is cleared", async () => {
  resetCatalogCache();
  const api = mockApi({ "POST /api/v2/orders": err(401, "UNAUTHORIZED") });
  try {
    const response = await checkout(req("/api/checkout", { items: cart, deliveryAddress: ADDRESS }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthenticated" });
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;.*Max-Age=0/i);
  } finally { api.restore(); }
});

test("preview sends the re-validated items (web-api prices them, so a free cart still previews) + zone and maps shipping fields", async () => {
  resetCatalogCache();
  const api = mockApi({ "POST /api/v2/orders/discount-preview": ok(previewData) });
  try {
    const response = await preview(req("/api/checkout/preview", { items: cart, couponCode: "ANSAR10", shippingZoneId: ZONE }));
    assert.deepEqual(await response.json(), {
      originalTotal: 518, totalDiscount: 51.8, finalTotal: 466.2, couponValid: true, couponMessage: null, pointsSpent: 0, pointsError: null,
      shippingEnabled: true, shippingRequired: true, shippingFee: 25, freeShippingApplied: false, amountToFreeShipping: 133.8, grandTotal: 491.2,
    });
    assert.deepEqual(api.calls.find((c) => c.key === "POST /api/v2/orders/discount-preview")?.body,
      { order_type: "STORE_ORDER", items: [{ item_id: SHIRT, quantity: 2, selected_option_ids: ["o-xxl"] }], coupon_code: "ANSAR10", shipping_zone_id: ZONE });
  } finally { api.restore(); }
});

test("shipping zones: maps enabled zones; an older web-api without the route means shipping is off", async () => {
  let api = mockApi({ "GET /api/v2/store/shipping-zones": ok({ enabled: true, zones: [previewData.shipping_zone] }) });
  try {
    assert.deepEqual(await (await zones()).json(), { enabled: true, zones: [{ id: ZONE, name: "المدينة المنورة", fee: 25, freeThreshold: 600 }] });
  } finally { api.restore(); }
  api = mockApi({ "GET /api/v2/store/shipping-zones": err(404, "NOT_FOUND") });
  try {
    assert.deepEqual(await (await zones()).json(), { enabled: false, zones: [] });
  } finally { api.restore(); }
});

test("payment intent, sync and status", async () => {
  const api = mockApi({
    "POST /api/v2/payments/create-intent": ok(intentData, 201),
    [`POST /api/v2/payments/${PAYMENT}/sync`]: ok({ payment_id: PAYMENT, status: "PAID", entity_type: "ORDER", entity_id: ORDER, synced: true }),
    [`GET /api/v2/payments/${PAYMENT}`]: ok({ id: PAYMENT, status: "PENDING", amount: 54300, currency: "SAR", entity_type: "ORDER", entity_id: ORDER }),
  });
  try {
    assert.equal((await (await intent(req("/api/payments/intent", { orderId: ORDER }))).json()).paymentId, PAYMENT);
    assert.equal((await intent(req("/api/payments/intent", { orderId: "x" }))).status, 400);
    const synced = await sync(req(`/api/payments/${PAYMENT}/sync`, { providerPaymentId: "pay_abc-123" }), ctx(PAYMENT));
    assert.deepEqual(await synced.json(), { paymentId: PAYMENT, status: "PAID", orderId: ORDER });
    assert.deepEqual(api.calls.find((c) => c.key.endsWith("/sync"))?.body, { provider_payment_id: "pay_abc-123" });
    assert.equal((await sync(req(`/api/payments/${PAYMENT}/sync`, { providerPaymentId: "bad id<script>" }), ctx(PAYMENT))).status, 400);
    assert.equal((await sync(req(`/api/payments/${PAYMENT}/sync`, { providerPaymentId: "a".repeat(256) }), ctx(PAYMENT))).status, 400);
    assert.deepEqual(await (await paymentStatus(req(`/api/payments/${PAYMENT}`), ctx(PAYMENT))).json(), { paymentId: PAYMENT, status: "PENDING", orderId: ORDER });
    assert.equal((await paymentStatus(req("/api/payments/nope"), ctx("nope"))).status, 400);
  } finally { api.restore(); }
});

test("orders list maps rows and needs a session", async () => {
  assert.equal((await orders(req("/api/orders", undefined, ""))).status, 401);
  const api = mockApi({ "GET /api/v2/orders": ok([orderRow, { id: "broken" }]) });
  try {
    const body = await (await orders(req("/api/orders"))).json();
    assert.equal(body.orders.length, 1);
    assert.equal(body.orders[0].total, 543);
  } finally { api.restore(); }
});
