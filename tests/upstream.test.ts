import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { absoluteAssetUrl, apiBaseUrl, upstream, UpstreamError } from "../lib/upstream";
import { clearSessionCookie, getSessionToken, isJsonRequest, SESSION_COOKIE, setSessionCookie } from "../lib/session";

process.env.ANSAR_API_BASE_URL = "http://api.test/";

test("apiBaseUrl strips trailing slashes; absoluteAssetUrl keeps absolute, prefixes relative, drops unsafe", () => {
  assert.equal(apiBaseUrl(), "http://api.test");
  assert.equal(absoluteAssetUrl("https://cdn.x/a.jpg"), "https://cdn.x/a.jpg");
  assert.equal(absoluteAssetUrl("/uploads/a.jpg"), "http://api.test/uploads/a.jpg");
  assert.equal(absoluteAssetUrl("//evil.test/a.jpg"), null);
  assert.equal(absoluteAssetUrl("javascript:alert(1)"), null);
  assert.equal(absoluteAssetUrl(""), null);
  assert.equal(absoluteAssetUrl(null), null);
});

test("upstream sends JSON + bearer token and unwraps the envelope", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "http://api.test/api/v2/users/me");
    const headers = init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer tok");
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(init.body, JSON.stringify({ a: 1 }));
    return Response.json({ data: { id: "u1" }, meta: { page: 1 }, error: null });
  });
  try {
    const result = await upstream<{ id: string }>("/api/v2/users/me", { method: "POST", body: { a: 1 }, token: "tok" });
    assert.deepEqual(result, { data: { id: "u1" }, meta: { page: 1 } });
  } finally { fetchMock.mock.restore(); }
});

test("upstream maps error envelopes and network failures to UpstreamError", async () => {
  let fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ data: null, meta: null, error: { code: "COUPON_EXPIRED", message: "x" } }, { status: 400 }));
  try {
    await assert.rejects(upstream("/api/v2/orders"), (e: unknown) => e instanceof UpstreamError && e.status === 400 && e.code === "COUPON_EXPIRED");
  } finally { fetchMock.mock.restore(); }
  fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  try {
    await assert.rejects(upstream("/api/v2/store"), (e: unknown) => e instanceof UpstreamError && e.status === 503 && e.code === "UPSTREAM_UNAVAILABLE");
  } finally { fetchMock.mock.restore(); }
  fetchMock = mock.method(globalThis, "fetch", async () => new Response("<html>", { status: 502 }));
  try {
    await assert.rejects(upstream("/api/v2/store"), (e: unknown) => e instanceof UpstreamError && e.status === 502 && e.code === "HTTP_502");
  } finally { fetchMock.mock.restore(); }
});

test("session cookie is httpOnly + lax and can be read back and cleared", () => {
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, "jwt-value");
  const header = response.headers.get("set-cookie") ?? "";
  assert.match(header, new RegExp(`^${SESSION_COOKIE}=jwt-value`));
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=lax/i);
  assert.match(header, /Max-Age=82800/);
  const request = new NextRequest("http://shop.test/api/auth/me", { headers: { cookie: `${SESSION_COOKIE}=jwt-value` } });
  assert.equal(getSessionToken(request), "jwt-value");
  assert.equal(getSessionToken(new NextRequest("http://shop.test/")), null);
  const cleared = NextResponse.json({ ok: true });
  clearSessionCookie(cleared);
  assert.match(cleared.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("isJsonRequest only accepts application/json bodies", () => {
  assert.equal(isJsonRequest(new Request("http://x", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" } })), true);
  assert.equal(isJsonRequest(new Request("http://x", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } })), false);
  assert.equal(isJsonRequest(new Request("http://x", { method: "POST" })), false);
});
