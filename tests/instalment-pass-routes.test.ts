import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as eligibility } from "../app/api/payments/instalments/eligibility/route";
import { POST as checkout } from "../app/api/payments/instalments/checkout/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const ORDER = "44444444-4444-4444-8444-444444444444";
const PASS = "66666666-6666-4666-8666-666666666666";
const PAYMENT = "55555555-5555-4555-8555-555555555555";
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });

type Call = { path: string; key: string; body: unknown };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (rawUrl: string, init: RequestInit) => {
    const url = new URL(rawUrl);
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    calls.push({ path: `${url.pathname}${url.search}`, key, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const req = (path: string, body?: unknown) => new NextRequest(`http://shop.test${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { cookie: "ansar_session=tok", ...(body === undefined ? {} : { "content-type": "application/json" }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("eligibility with passId asks web-api about the SEASON_PASS", async () => {
  const api = mockApi({ "GET /api/v2/payments/instalments/eligibility": ok({ available: true, instalments: 4, instalment_amount: 11250 }) });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?passId=${PASS}&amount=45000`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { available: true, instalments: 4, instalmentAmountHalalah: 11250 });
    const query = new URLSearchParams(api.calls[0].path.split("?")[1]);
    assert.equal(query.get("entity_type"), "SEASON_PASS");
    assert.equal(query.get("entity_id"), PASS);
    assert.equal(query.get("amount"), "45000");
  } finally {
    api.restore();
  }
});

test("eligibility refuses both ids, or neither (400)", async () => {
  assert.equal((await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&passId=${PASS}&amount=45000`))).status, 400);
  assert.equal((await eligibility(req("/api/payments/instalments/eligibility?amount=45000"))).status, 400);
});

test("checkout with passId opens a WEB Tamara session for the SEASON_PASS", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({ payment_id: PAYMENT, checkout_url: "https://checkout.tamara.co/pay/1" }),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { passId: PASS, amount: 45000 }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { paymentId: PAYMENT, checkoutUrl: "https://checkout.tamara.co/pay/1" });
    assert.deepEqual(api.calls[0].body, {
      entity_type: "SEASON_PASS", entity_id: PASS, amount: 45000, currency: "SAR", locale: "ar", return_channel: "WEB",
    });
  } finally {
    api.restore();
  }
});

test("checkout refuses both ids, or neither (400)", async () => {
  assert.equal((await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, passId: PASS, amount: 45000 }))).status, 400);
  assert.equal((await checkout(req("/api/payments/instalments/checkout", { amount: 45000 }))).status, 400);
});
