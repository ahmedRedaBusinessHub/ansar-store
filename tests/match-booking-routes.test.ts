import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as book } from "../app/api/match-bookings/route";
import { POST as intent } from "../app/api/match-bookings/[id]/intent/route";
import { GET as paymentStatus } from "../app/api/match-payments/[id]/route";
import { POST as paymentSync } from "../app/api/match-payments/[id]/sync/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const M = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const P = "55555555-5555-4555-8555-555555555555";
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });
const section = (over: Record<string, unknown> = {}) => ({
  id: S, match_id: M, name_ar: "المدرج الشرقي", name_en: "East", kind: "GENERAL", venue_section_id: null,
  price: 100, capacity: 500, booked_count: 20, is_full: false, created_at: "2026-10-01T00:00:00.000Z", ...over,
});

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
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const SECTIONS = `GET /api/v2/matches/${M}/sections`;

test("booking requires JSON, a session and a valid body", async () => {
  const plain = new NextRequest("http://shop.test/api/match-bookings", { method: "POST", headers: { cookie: "ansar_session=tok", "content-type": "text/plain" }, body: "{}" });
  assert.equal((await book(plain)).status, 415);
  assert.equal((await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }, { cookie: "" }))).status, 401);
  assert.equal((await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 11 }))).status, 400);
  assert.equal((await book(post("/api/match-bookings", { matchId: "x", sectionId: S, quantity: 1 }))).status, 400);
});

test("GENERAL section books by quantity with the session token", async () => {
  const api = mockApi({
    [SECTIONS]: ok([section()]),
    "POST /api/v2/match-bookings": { status: 201, body: { booking: { id: B, status: "PENDING_PAYMENT" } } },
  });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 2 }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { bookingId: B, status: "PENDING_PAYMENT", expiresAt: null });
    const call = api.calls.find((c) => c.key === "POST /api/v2/match-bookings");
    assert.deepEqual(call?.body, { match_id: M, section_id: S, quantity: 2 });
    assert.equal(call?.auth, "Bearer tok");
  } finally { api.restore(); }
});

test("SEATED section holds the best seats and returns the hold expiry", async () => {
  const api = mockApi({
    [SECTIONS]: ok([section({ kind: "SEATED" })]),
    [`POST /api/v2/matches/${M}/best-available`]: { status: 201, body: { data: { booking_id: B, expires_at: "2026-10-12T12:10:00.000Z", held_seats: ["a", "b"] } } },
  });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 2 }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { bookingId: B, status: "PENDING_PAYMENT", expiresAt: "2026-10-12T12:10:00.000Z" });
    assert.deepEqual(api.calls.find((c) => c.key.endsWith("/best-available"))?.body, { section_id: S, quantity: 2 });
  } finally { api.restore(); }
});

test("free seated booking is confirmed with no hold", async () => {
  const api = mockApi({
    [SECTIONS]: ok([section({ kind: "SEATED", price: 0 })]),
    [`POST /api/v2/matches/${M}/best-available`]: { status: 201, body: { data: { booking_id: B, expires_at: "2026-10-12T12:10:00.000Z", held_seats: ["a"] } } },
  });
  try {
    assert.deepEqual(await (await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }))).json(),
      { bookingId: B, status: "CONFIRMED", expiresAt: null });
  } finally { api.restore(); }
});

test("unknown or unpriced sections never reach the booking endpoint", async () => {
  let api = mockApi({ [SECTIONS]: ok([]) });
  try {
    assert.equal((await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }))).status, 404);
    assert.deepEqual(api.calls.map((c) => c.key), [SECTIONS]);
  } finally { api.restore(); }
  api = mockApi({ [SECTIONS]: ok([section({ price: null })]) });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }));
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "booking_rejected", code: "SECTION_NOT_PRICED" });
  } finally { api.restore(); }
});

test("upstream refusals pass their code (and the largest block) to the browser", async () => {
  let api = mockApi({
    [SECTIONS]: ok([section({ kind: "SEATED" })]),
    [`POST /api/v2/matches/${M}/best-available`]: { status: 409, body: { error: "No contiguous block", code: "NO_CONTIGUOUS_BLOCK", largest_available: 3, alternatives: [] } },
  });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 5 }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "booking_rejected", code: "NO_CONTIGUOUS_BLOCK", largestAvailable: 3 });
  } finally { api.restore(); }

  api = mockApi({
    [SECTIONS]: ok([section()]),
    "POST /api/v2/match-bookings": { status: 403, body: { error: "SALES_CLOSED", code: "SALES_CLOSED", message: "closed" } },
  });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "booking_rejected", code: "SALES_CLOSED" });
  } finally { api.restore(); }

  api = mockApi({ [SECTIONS]: ok([section()]), "POST /api/v2/match-bookings": err(429, "RATE_LIMIT_EXCEEDED") });
  try {
    assert.equal((await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }))).status, 429);
  } finally { api.restore(); }

  api = mockApi({ [SECTIONS]: ok([section()]), "POST /api/v2/match-bookings": err(401, "UNAUTHORIZED") });
  try {
    const response = await book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;/);
  } finally { api.restore(); }
});

test("one IP gets 20 booking attempts per window", async () => {
  delete process.env.TRUSTED_PROXY_IPS;
  const api = mockApi({ [SECTIONS]: ok([]) });
  try {
    const attempt = () => book(post("/api/match-bookings", { matchId: M, sectionId: S, quantity: 1 }, { "x-forwarded-for": "203.0.113.50" }));
    for (let i = 0; i < 20; i++) assert.equal((await attempt()).status, 404);
    assert.equal((await attempt()).status, 429);
  } finally { api.restore(); }
});

test("intent creates a MATCH_BOOKING payment intent", async () => {
  const intentData = { payment_id: P, given_id: "66666666-6666-4666-8666-666666666666", amount: 20000, currency: "SAR", description: `MATCH_BOOKING #${B}`,
    sdk_config: { amount: 20000, currency: "SAR", metadata: { payment_id: P, entity_type: "MATCH_BOOKING", entity_id: B } } };
  let api = mockApi({ "POST /api/v2/payments/create-intent": ok(intentData, 201) });
  try {
    const response = await intent(post(`/api/match-bookings/${B}/intent`, {}), ctx(B));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).paymentId, P);
    assert.deepEqual(api.calls[0].body, { entity_type: "MATCH_BOOKING", entity_id: B });
  } finally { api.restore(); }
  assert.equal((await intent(post("/api/match-bookings/x/intent", {}), ctx("x"))).status, 400);
  api = mockApi({ "POST /api/v2/payments/create-intent": err(400, "INVALID_STATUS") });
  try {
    const response = await intent(post(`/api/match-bookings/${B}/intent`, {}), ctx(B));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "INVALID_STATUS");
  } finally { api.restore(); }
});

test("match payment status and sync accept MATCH_BOOKING payments only", async () => {
  const state = { status: "PAID", entity_type: "MATCH_BOOKING", entity_id: B };
  let api = mockApi({ [`GET /api/v2/payments/${P}`]: ok(state), [`POST /api/v2/payments/${P}/sync`]: ok(state) });
  try {
    const get = new NextRequest(`http://shop.test/api/match-payments/${P}`, { headers: { cookie: "ansar_session=tok" } });
    assert.deepEqual(await (await paymentStatus(get, ctx(P))).json(), { paymentId: P, status: "PAID", bookingId: B });
    const synced = await paymentSync(post(`/api/match-payments/${P}/sync`, { providerPaymentId: "pay_abc-123" }), ctx(P));
    assert.deepEqual(await synced.json(), { paymentId: P, status: "PAID", bookingId: B });
    assert.deepEqual(api.calls.find((c) => c.key.endsWith("/sync"))?.body, { provider_payment_id: "pay_abc-123" });
  } finally { api.restore(); }
  api = mockApi({ [`GET /api/v2/payments/${P}`]: ok({ status: "PAID", entity_type: "ORDER", entity_id: B }) });
  try {
    const get = new NextRequest(`http://shop.test/api/match-payments/${P}`, { headers: { cookie: "ansar_session=tok" } });
    assert.equal((await paymentStatus(get, ctx(P))).status, 404);
  } finally { api.restore(); }
});
