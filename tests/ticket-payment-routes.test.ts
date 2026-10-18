import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as status } from "../app/api/ticket-payments/[id]/route";
import { POST as sync } from "../app/api/ticket-payments/[id]/sync/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const P = "55555555-5555-4555-8555-555555555555";
const B = "33333333-3333-4333-8333-333333333333";
const PASS = "66666666-6666-4666-8666-666666666666";
const ok = (data: unknown, code = 200) => ({ status: code, body: { data, meta: null, error: null } });

type Call = { key: string; body: unknown; auth: string | null };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>).Authorization ?? null });
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const get = (path: string, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, { headers: { cookie } });
const post = (path: string, body: unknown) => new NextRequest(`http://shop.test${path}`, {
  method: "POST", headers: { cookie: "ansar_session=tok", "content-type": "application/json" }, body: JSON.stringify(body),
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("status: 401 without a session, 400 for a bad id", async () => {
  assert.equal((await status(get(`/api/ticket-payments/${P}`, ""), ctx(P))).status, 401);
  assert.equal((await status(get("/api/ticket-payments/x"), ctx("x"))).status, 400);
});

test("status returns the entity of a season-pass payment", async () => {
  const api = mockApi({ [`GET /api/v2/payments/${P}`]: ok({ status: "PAID", entity_type: "SEASON_PASS", entity_id: PASS }) });
  try {
    const response = await status(get(`/api/ticket-payments/${P}`), ctx(P));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { paymentId: P, status: "PAID", entityType: "SEASON_PASS", entityId: PASS });
    assert.equal(api.calls[0].auth, "Bearer tok");
  } finally {
    api.restore();
  }
});

test("status: a store-order payment looks missing (404)", async () => {
  const api = mockApi({ [`GET /api/v2/payments/${P}`]: ok({ status: "PAID", entity_type: "ORDER", entity_id: B }) });
  try {
    assert.equal((await status(get(`/api/ticket-payments/${P}`), ctx(P))).status, 404);
  } finally {
    api.restore();
  }
});

test("sync forwards the Moyasar id and returns the state", async () => {
  const api = mockApi({ [`POST /api/v2/payments/${P}/sync`]: ok({ status: "PAID", entity_type: "MATCH_BOOKING", entity_id: B }) });
  try {
    const response = await sync(post(`/api/ticket-payments/${P}/sync`, { providerPaymentId: "mysr_123" }), ctx(P));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { paymentId: P, status: "PAID", entityType: "MATCH_BOOKING", entityId: B });
    assert.deepEqual(api.calls[0].body, { provider_payment_id: "mysr_123" });
  } finally {
    api.restore();
  }
});

test("sync refuses a malformed provider id and non-JSON bodies", async () => {
  assert.equal((await sync(post(`/api/ticket-payments/${P}/sync`, { providerPaymentId: "bad id!" }), ctx(P))).status, 400);
  const plain = new NextRequest(`http://shop.test/api/ticket-payments/${P}/sync`, {
    method: "POST", headers: { cookie: "ansar_session=tok", "content-type": "text/plain" }, body: "{}",
  });
  assert.equal((await sync(plain, ctx(P))).status, 415);
});
