import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { clientIpFrom, trustedProxies } from "../lib/client-ip";
import { absoluteAssetUrl, upstream, upstreamBody, upstreamRaw, UpstreamError } from "../lib/upstream";
import { POST as requestOtp } from "../app/api/auth/request-otp/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const SECRET = "k".repeat(32);
const h = (init: Record<string, string>) => new Headers(init);
const trusted = new Set(["10.101.0.2", "127.0.0.1"]);

test("clientIpFrom walks x-forwarded-for from the right and skips trusted hops", () => {
  assert.equal(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9, 10.101.0.2" }), trusted), "203.0.113.9");
  // A spoofed leading value is ignored: the first untrusted hop from the right wins.
  assert.equal(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.101.0.2" }), trusted), "203.0.113.9");
  assert.equal(clientIpFrom(h({ "x-forwarded-for": "2001:db8::1, 127.0.0.1" }), trusted), "2001:db8::1");
});

test("clientIpFrom never trusts a malformed hop or a trusted-only chain", () => {
  assert.equal(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4, evil, 10.101.0.2" }), trusted), null);
  assert.equal(clientIpFrom(h({ "x-forwarded-for": "10.101.0.2" }), trusted), null);
  assert.equal(clientIpFrom(h({}), trusted), null);
});

test("clientIpFrom falls back to an untrusted, valid x-real-ip", () => {
  assert.equal(clientIpFrom(h({ "x-real-ip": "198.51.100.4" }), trusted), "198.51.100.4");
  assert.equal(clientIpFrom(h({ "x-real-ip": "10.101.0.2" }), trusted), null);
  assert.equal(clientIpFrom(h({ "x-real-ip": "nope" }), trusted), null);
});

test("trustedProxies reads TRUSTED_PROXY_IPS", () => {
  process.env.TRUSTED_PROXY_IPS = " 10.101.0.2 ,127.0.0.1,, ";
  assert.deepEqual([...trustedProxies()], ["10.101.0.2", "127.0.0.1"]);
  delete process.env.TRUSTED_PROXY_IPS;
  assert.equal(trustedProxies().size, 0);
});

test("upstream forwards the client IP only when the proxy secret is configured", async () => {
  const seen: Record<string, string>[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    seen.push(init.headers as Record<string, string>);
    return Response.json({ data: {}, meta: null, error: null });
  });
  try {
    delete process.env.STOREFRONT_PROXY_SECRET;
    await upstream("/api/v2/x", { clientIp: "203.0.113.9" });
    process.env.STOREFRONT_PROXY_SECRET = "short";
    await upstream("/api/v2/x", { clientIp: "203.0.113.9" });
    process.env.STOREFRONT_PROXY_SECRET = SECRET;
    await upstream("/api/v2/x", { clientIp: "203.0.113.9" });
    await upstream("/api/v2/x", { clientIp: null });
  } finally {
    fetchMock.mock.restore();
    delete process.env.STOREFRONT_PROXY_SECRET;
  }
  assert.equal(seen[0]["X-Client-IP"], undefined);
  assert.equal(seen[1]["X-Client-IP"], undefined);
  assert.equal(seen[2]["X-Client-IP"], "203.0.113.9");
  assert.equal(seen[2]["X-Storefront-Key"], SECRET);
  assert.equal(seen[3]["X-Client-IP"], undefined);
  assert.equal(seen[3]["X-Storefront-Key"], undefined);
});

test("upstreamBody returns non-envelope bodies and reads flat error shapes", async () => {
  let fetchMock = mock.method(globalThis, "fetch", async () => Response.json({ booking: { id: "b1" } }, { status: 201 }));
  try {
    assert.deepEqual(await upstreamBody("/api/v2/match-bookings", { method: "POST", body: {} }), { booking: { id: "b1" } });
  } finally { fetchMock.mock.restore(); }

  fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "SALES_CLOSED", code: "SALES_CLOSED", message: "closed" }, { status: 403 }));
  try {
    await assert.rejects(upstreamBody("/x"), (e: unknown) =>
      e instanceof UpstreamError && e.status === 403 && e.code === "SALES_CLOSED" && e.message === "closed");
  } finally { fetchMock.mock.restore(); }

  fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "No contiguous block", code: "NO_CONTIGUOUS_BLOCK", largest_available: 3 }, { status: 409 }));
  try {
    await assert.rejects(upstreamBody("/x"), (e: unknown) =>
      e instanceof UpstreamError && e.code === "NO_CONTIGUOUS_BLOCK" && e.details.largest_available === 3);
  } finally { fetchMock.mock.restore(); }
});

test("upstreamRaw returns the raw response and maps network failures", async () => {
  let fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } }));
  try {
    const response = await upstreamRaw("/api/v2/tickets/t/pdf", { token: "tok" });
    assert.equal(await response.text(), "%PDF");
  } finally { fetchMock.mock.restore(); }

  fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  try {
    await assert.rejects(upstreamRaw("/x"), (e: unknown) => e instanceof UpstreamError && e.status === 503);
  } finally { fetchMock.mock.restore(); }
});

test("asset URLs use the public web-api origin when configured", () => {
  process.env.ANSAR_PUBLIC_API_URL = "https://app.alansar.sa/";
  assert.equal(absoluteAssetUrl("/uploads/a.png"), "https://app.alansar.sa/uploads/a.png");
  delete process.env.ANSAR_PUBLIC_API_URL;
  assert.equal(absoluteAssetUrl("/uploads/a.png"), "http://api.test/uploads/a.png");
});

test("auth routes forward the visitor IP", async () => {
  process.env.STOREFRONT_PROXY_SECRET = SECRET;
  process.env.TRUSTED_PROXY_IPS = "10.101.0.2";
  let headers: Record<string, string> = {};
  const fetchMock = mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return Response.json({ data: { requiresEmail: false }, meta: null, error: null });
  });
  try {
    const response = await requestOtp(new NextRequest("http://shop.test/api/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.101.0.2" },
      body: JSON.stringify({ phone: "+966512345678" }),
    }));
    assert.equal(response.status, 200);
  } finally {
    fetchMock.mock.restore();
    delete process.env.STOREFRONT_PROXY_SECRET;
    delete process.env.TRUSTED_PROXY_IPS;
  }
  assert.equal(headers["X-Client-IP"], "203.0.113.9");
});
