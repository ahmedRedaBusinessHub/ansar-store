import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as myPasses, POST as buy } from "../app/api/season-passes/route";
import { POST as intent } from "../app/api/season-passes/[id]/intent/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const SEASON = "11111111-1111-4111-8111-111111111111";
const PAID_OPEN = "22222222-2222-4222-8222-222222222222";
const FREE_SEAT = "22222222-2222-4222-8222-222222222223";
const PAID_SEAT = "22222222-2222-4222-8222-222222222224";
const PASS = "33333333-3333-4333-8333-333333333333";
const PASS2 = "33333333-3333-4333-8333-333333333334";
const SEAT1 = "b0000000-0000-4000-8000-000000000001";
const SEAT2 = "b0000000-0000-4000-8000-000000000002";
const PAYMENT = "55555555-5555-4555-8555-555555555555";
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });
const err = (status: number, code: string, details?: Record<string, unknown>) =>
  ({ status, body: { data: null, meta: null, error: { code, message: code, ...(details ? { details } : {}) } } });

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
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://shop.test${path}`, {
  method: "POST",
  headers: { cookie: "ansar_session=tok", "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const get = (path: string, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, { headers: { cookie } });
const tier = (id: string, price: number, mode: "OPEN" | "SEAT") =>
  ({ id, name_ar: "فئة", price, mode, capacity: 0, sold_count: 0, is_full: false, benefits: [],
     seat_summary: mode === "SEAT" ? { total: 10, taken_by_pass: 0, blocked: 0, available: 10 } : null });
const OFFER = {
  "GET /api/v2/seasons/current": ok({ id: SEASON, year: "2026-2027" }),
  [`GET /api/v2/seasons/${SEASON}/tiers`]: ok([tier(PAID_OPEN, 450, "OPEN"), tier(FREE_SEAT, 0, "SEAT"), tier(PAID_SEAT, 900, "SEAT")]),
};
const BUY = "POST /api/v2/season-passes";

test("buy requires JSON, a session and a valid body", async () => {
  const plain = new NextRequest("http://shop.test/api/season-passes", { method: "POST", headers: { cookie: "ansar_session=tok", "content-type": "text/plain" }, body: "{}" });
  assert.equal((await buy(plain)).status, 415);
  assert.equal((await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 1 }, { cookie: "" }))).status, 401);
  assert.equal((await buy(post("/api/season-passes", { tierId: "x", quantity: 1 }))).status, 400);
  assert.equal((await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 11 }))).status, 400);
  assert.equal((await buy(post("/api/season-passes", { tierId: FREE_SEAT, quantity: 2, seatIds: [SEAT1, SEAT1] }))).status, 400);
});

test("paid OPEN tier: buys one pass with the session token, no seats", async () => {
  const api = mockApi({ ...OFFER, [BUY]: ok({ pass_ids: [PASS], status: "PENDING_PAYMENT", passes: [{ id: PASS, expires_at: null }] }, 201) });
  try {
    const response = await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 1, seatIds: [SEAT1] }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { passId: PASS, status: "PENDING_PAYMENT", expiresAt: null });
    const call = api.calls.find((c) => c.key === BUY);
    assert.deepEqual(call?.body, { season_id: SEASON, tier_id: PAID_OPEN, quantity: 1 });
    assert.equal(call?.auth, "Bearer tok");
  } finally {
    api.restore();
  }
});

test("paid tier: more than one pass is refused before web-api (PAID_QTY_LIMIT)", async () => {
  const api = mockApi({ ...OFFER });
  try {
    const response = await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 2 }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "PAID_QTY_LIMIT");
    assert.equal(api.calls.some((c) => c.key === BUY), false);
    const seatResponse = await buy(post("/api/season-passes", { tierId: PAID_SEAT, quantity: 2, seatIds: [SEAT1, SEAT2] }));
    assert.equal((await seatResponse.json()).code, "PAID_QTY_LIMIT");
  } finally {
    api.restore();
  }
});

test("SEAT tier without seats → 400 SEAT_SELECTION_REQUIRED", async () => {
  const api = mockApi({ ...OFFER });
  try {
    const response = await buy(post("/api/season-passes", { tierId: FREE_SEAT, quantity: 1 }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "SEAT_SELECTION_REQUIRED");
  } finally {
    api.restore();
  }
});

test("free SEAT tier: sends the seats and quantity = number of seats", async () => {
  const api = mockApi({ ...OFFER, [BUY]: ok({ pass_ids: [PASS, PASS2], status: "ACTIVE", passes: [] }, 201) });
  try {
    const response = await buy(post("/api/season-passes", { tierId: FREE_SEAT, quantity: 1, seatIds: [SEAT1, SEAT2] }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { passId: PASS, status: "ACTIVE", expiresAt: null });
    assert.deepEqual(api.calls.find((c) => c.key === BUY)?.body, { season_id: SEASON, tier_id: FREE_SEAT, quantity: 2, venue_seat_ids: [SEAT1, SEAT2] });
  } finally {
    api.restore();
  }
});

test("unknown tier → 404", async () => {
  const api = mockApi({ ...OFFER });
  try {
    assert.equal((await buy(post("/api/season-passes", { tierId: PASS, quantity: 1 }))).status, 404);
  } finally {
    api.restore();
  }
});

test("seat conflict → 409 with the taken seat ids", async () => {
  const api = mockApi({ ...OFFER, [BUY]: err(409, "SEASON_SEAT_CONFLICT", { taken_seat_ids: [SEAT1] }) });
  try {
    const response = await buy(post("/api/season-passes", { tierId: PAID_SEAT, quantity: 1, seatIds: [SEAT1] }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "pass_rejected", code: "SEASON_SEAT_CONFLICT", takenSeatIds: [SEAT1] });
  } finally {
    api.restore();
  }
});

test("upstream 429 → 429; upstream 401 clears the session", async () => {
  let api = mockApi({ ...OFFER, [BUY]: err(429, "RATE_LIMIT_EXCEEDED") });
  try {
    assert.equal((await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 1 }))).status, 429);
  } finally {
    api.restore();
  }
  api = mockApi({ ...OFFER, [BUY]: err(401, "UNAUTHORIZED") });
  try {
    const response = await buy(post("/api/season-passes", { tierId: PAID_OPEN, quantity: 1 }));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;/);
  } finally {
    api.restore();
  }
});

test("GET my passes: QR as SVG for ACTIVE only, ACTIVE first, ?pass= filter", async () => {
  const rows = [
    { id: PASS2, status: "PENDING_PAYMENT", qr_payload: null, expires_at: null, seat: null, tier: { name_ar: "فضية" }, season: { year: "2026-2027" }, created_at: "2026-10-14T11:00:00.000Z" },
    { id: PASS, status: "ACTIVE", qr_payload: "qr-secret-1", expires_at: null, seat: null, tier: { name_ar: "ذهبية" }, season: { year: "2026-2027" }, created_at: "2026-10-14T10:00:00.000Z" },
  ];
  const api = mockApi({ "GET /api/v2/season-passes": ok(rows) });
  try {
    const all = await (await myPasses(get("/api/season-passes"))).json();
    assert.deepEqual(all.passes.map((p: { id: string }) => p.id), [PASS, PASS2]);
    assert.match(all.passes[0].qrSvg, /<svg/);
    assert.equal(all.passes[1].qrSvg, null);
    assert.equal("qrPayload" in all.passes[0], false);
    const one = await (await myPasses(get(`/api/season-passes?pass=${PASS2}`))).json();
    assert.deepEqual(one.passes.map((p: { id: string }) => p.id), [PASS2]);
    assert.equal((await myPasses(get("/api/season-passes?pass=bad"))).status, 400);
    assert.equal((await myPasses(get("/api/season-passes", ""))).status, 401);
  } finally {
    api.restore();
  }
});

test("intent creates a SEASON_PASS payment", async () => {
  const api = mockApi({
    "POST /api/v2/payments/create-intent": ok({
      payment_id: PAYMENT, given_id: "g1", amount: 45000, currency: "SAR", description: "Season pass",
      sdk_config: { metadata: { payment_id: PAYMENT, entity_type: "SEASON_PASS", entity_id: PASS } },
    }, 201),
  });
  try {
    const response = await intent(post(`/api/season-passes/${PASS}/intent`, {}), { params: Promise.resolve({ id: PASS }) });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.paymentId, PAYMENT);
    assert.equal(body.amountHalalah, 45000);
    assert.deepEqual(api.calls[0].body, { entity_type: "SEASON_PASS", entity_id: PASS });
  } finally {
    api.restore();
  }
  assert.equal((await intent(post("/api/season-passes/x/intent", {}), { params: Promise.resolve({ id: "x" }) })).status, 400);
});

test("intent for an expired or already-paid pass → 422 INVALID_STATUS (pay page shows the restart message)", async () => {
  const api = mockApi({ "POST /api/v2/payments/create-intent": err(400, "INVALID_STATUS") });
  try {
    const response = await intent(post(`/api/season-passes/${PASS}/intent`, {}), { params: Promise.resolve({ id: PASS }) });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "INVALID_STATUS");
  } finally {
    api.restore();
  }
});
