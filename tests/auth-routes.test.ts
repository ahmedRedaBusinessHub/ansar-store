import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as requestOtp } from "../app/api/auth/request-otp/route";
import { POST as verifyOtp } from "../app/api/auth/verify-otp/route";
import { POST as register } from "../app/api/auth/register/route";
import { GET as me } from "../app/api/auth/me/route";
import { POST as logout } from "../app/api/auth/logout/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const user = { id: "u1", phone: "+966512345678", email: null, name: "أحمد", points: 120, role: "USER", provider: "PHONE" };

const post = (path: string, body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new NextRequest(`http://shop.test${path}`, { method: "POST", headers, body: JSON.stringify(body) });

type Reply = { status?: number; body: unknown };
function mockApi(routes: Record<string, Reply>) {
  return mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected call ${key}`);
    return Response.json(reply.body, { status: reply.status ?? 200 });
  });
}
const ok = (data: unknown) => ({ body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

test("request-otp validates input, rejects non-JSON and forwards requiresEmail", async () => {
  assert.equal((await requestOtp(post("/api/auth/request-otp", { phone: "+966512345678" }, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await requestOtp(post("/api/auth/request-otp", { phone: "0512" }))).status, 400);
  const fetchMock = mockApi({ "POST /api/v2/auth/phone/request-otp": ok({ message: "sent", requiresEmail: true }) });
  try {
    const response = await requestOtp(post("/api/auth/request-otp", { phone: "+201001234567" }));
    assert.deepEqual(await response.json(), { ok: true, requiresEmail: true });
  } finally { fetchMock.mock.restore(); }
  const limited = mockApi({ "POST /api/v2/auth/phone/request-otp": err(429, "RATE_LIMIT_EXCEEDED") });
  try {
    const response = await requestOtp(post("/api/auth/request-otp", { phone: "+966512345678" }));
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: "rate_limited" });
  } finally { limited.mock.restore(); }
});

test("verify-otp sets the httpOnly session cookie and returns the member", async () => {
  const fetchMock = mockApi({
    "POST /api/v2/auth/phone/verify-otp": ok({ token: "jwt-1", user, isNewUser: false }),
    "GET /api/v2/users/me": ok(user),
    "GET /api/v2/invitations/balance": ok({ has_active_membership: true }),
  });
  try {
    const response = await verifyOtp(post("/api/auth/verify-otp", { phone: user.phone, otp: "1111" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, isNewUser: false, user: { id: "u1", name: "أحمد", phone: user.phone, points: 120, isMember: true } });
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=jwt-1;.*HttpOnly/i);
  } finally { fetchMock.mock.restore(); }
});

test("verify-otp: new user → isNewUser without cookie; wrong code → otp_invalid", async () => {
  let fetchMock = mockApi({ "POST /api/v2/auth/phone/verify-otp": ok({ isNewUser: true }) });
  try {
    const response = await verifyOtp(post("/api/auth/verify-otp", { phone: user.phone, otp: "1111" }));
    assert.deepEqual(await response.json(), { ok: true, isNewUser: true, user: null });
    assert.equal(response.headers.get("set-cookie"), null);
  } finally { fetchMock.mock.restore(); }
  fetchMock = mockApi({ "POST /api/v2/auth/phone/verify-otp": err(401, "UNAUTHORIZED") });
  try {
    const response = await verifyOtp(post("/api/auth/verify-otp", { phone: user.phone, otp: "9999" }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "otp_invalid" });
  } finally { fetchMock.mock.restore(); }
  assert.equal((await verifyOtp(post("/api/auth/verify-otp", { phone: user.phone, otp: "12a4" }))).status, 400);
});

test("register creates the account and signs in; 409 → conflict; spent proof → verification_expired", async () => {
  let fetchMock = mockApi({
    "POST /api/v2/auth/phone/register": ok({ token: "jwt-2", user, isNewUser: false }),
    "GET /api/v2/users/me": ok(user),
    "GET /api/v2/invitations/balance": ok({ has_active_membership: false }),
  });
  try {
    const response = await register(post("/api/auth/register", { phone: user.phone, name: "أحمد" }));
    assert.equal((await response.json()).user.isMember, false);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=jwt-2/);
  } finally { fetchMock.mock.restore(); }
  fetchMock = mockApi({ "POST /api/v2/auth/phone/register": err(409, "CONFLICT") });
  try {
    assert.equal((await register(post("/api/auth/register", { phone: user.phone, name: "أحمد" }))).status, 409);
  } finally { fetchMock.mock.restore(); }
  fetchMock = mockApi({ "POST /api/v2/auth/phone/register": err(401, "PHONE_NOT_VERIFIED") });
  try {
    const response = await register(post("/api/auth/register", { phone: user.phone, name: "أحمد" }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "verification_expired" });
  } finally { fetchMock.mock.restore(); }
  assert.equal((await register(post("/api/auth/register", { phone: user.phone, name: "أ" }))).status, 400);
});

test("me returns null without a cookie, clears an expired cookie, and logout clears it", async () => {
  assert.deepEqual(await (await me(new NextRequest("http://shop.test/api/auth/me"))).json(), { user: null });
  const fetchMock = mockApi({ "GET /api/v2/users/me": err(401, "UNAUTHORIZED") });
  try {
    const response = await me(new NextRequest("http://shop.test/api/auth/me", { headers: { cookie: "ansar_session=old" } }));
    assert.deepEqual(await response.json(), { user: null });
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;.*Max-Age=0/i);
  } finally { fetchMock.mock.restore(); }
  const out = await logout(post("/api/auth/logout", {}));
  assert.deepEqual(await out.json(), { ok: true });
  assert.match(out.headers.get("set-cookie") ?? "", /Max-Age=0/);
});
