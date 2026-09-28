import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as eligibility } from "../app/api/payments/instalments/eligibility/route";
import { POST as checkout } from "../app/api/payments/instalments/checkout/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const ORDER = "44444444-4444-4444-8444-444444444444";
const PAYMENT = "55555555-5555-4555-8555-555555555555";

const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

type Call = { url: string; path: string; key: string; body: unknown; auth: string | null };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (rawUrl: string, init: RequestInit) => {
    const urlObj = new URL(rawUrl);
    const path = `${urlObj.pathname}${urlObj.search}`;
    const key = `${init.method ?? "GET"} ${urlObj.pathname}`;
    const fullKey = `${init.method ?? "GET"} ${path}`;
    calls.push({
      url: String(rawUrl),
      path,
      key,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: (init.headers as Record<string, string> | undefined)?.Authorization ?? null,
    });
    const reply = routes[fullKey] ?? routes[key];
    if (!reply) throw new Error(`unexpected fetch to ${key} (${path})`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}

const req = (path: string, body?: unknown, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("instalments eligibility: unauthenticated request returns 401", async () => {
  const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000`, undefined, ""));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthenticated" });
});

test("instalments eligibility: invalid amount returns 400", async () => {
  const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=abc`));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("instalments eligibility: bad orderId returns 400", async () => {
  const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=bad-order-id&amount=19000`));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("instalments eligibility: happy path returns 200 with instalments and verifies upstream URL and auth", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": ok({ available: true, instalments: 4, instalment_amount: 4750 }),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: true,
      instalments: 4,
      instalmentAmountHalalah: 4750,
    });
    const call = api.calls[0];
    assert.equal(call?.path, `/api/v2/payments/instalments/eligibility?entity_type=ORDER&entity_id=${ORDER}&amount=19000&currency=SAR`);
    assert.equal(call?.url, `http://api.test/api/v2/payments/instalments/eligibility?entity_type=ORDER&entity_id=${ORDER}&amount=19000&currency=SAR`);
    assert.equal(call?.auth, "Bearer tok");
  } finally {
    api.restore();
  }
});

test("instalments eligibility: upstream unavailable (available: false) returns 200 with unavailable payload", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": ok({ available: false }),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: false,
      instalments: null,
      instalmentAmountHalalah: null,
    });
  } finally {
    api.restore();
  }
});

test("instalments eligibility: upstream 500 returns 200 with unavailable payload", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": err(500, "INTERNAL_ERROR"),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: false,
      instalments: null,
      instalmentAmountHalalah: null,
    });
  } finally {
    api.restore();
  }
});

test("instalments eligibility: upstream 401 returns 401 unauthenticated and clears session cookie", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": err(401, "UNAUTHORIZED"),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000`));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthenticated" });
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;.*Max-Age=0/i);
  } finally {
    api.restore();
  }
});

test("instalments checkout: non-JSON request returns 415", async () => {
  const plain = new NextRequest("http://shop.test/api/payments/instalments/checkout", {
    method: "POST",
    headers: { cookie: "ansar_session=tok", "content-type": "text/plain" },
    body: "{}",
  });
  const response = await checkout(plain);
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("instalments checkout: unauthenticated request returns 401", async () => {
  const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }, ""));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthenticated" });
});

test("instalments checkout: non-integer amount returns 400", async () => {
  const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 1.5 }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("instalments checkout: happy path returns 201 with session info and sends correct body to upstream", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://checkout-sandbox.tamara.co/abc",
      expires_at: "2026-09-28T16:00:00.000Z",
      resumed: false,
    }, 201),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      paymentId: PAYMENT,
      checkoutUrl: "https://checkout-sandbox.tamara.co/abc",
    });
    const call = api.calls[0];
    assert.deepEqual(call?.body, {
      entity_type: "ORDER",
      entity_id: ORDER,
      amount: 19000,
      currency: "SAR",
      locale: "ar",
      return_channel: "WEB",
    });
    assert.equal(call?.auth, "Bearer tok");
  } finally {
    api.restore();
  }
});

test("instalments checkout: untrusted checkout URL returns 503 upstream_unavailable", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://evil.example/x",
    }),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally {
    api.restore();
  }
});

test("instalments checkout: upstream 409 AMOUNT_MISMATCH maps to 409 order_rejected", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": err(409, "AMOUNT_MISMATCH"),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "order_rejected", code: "AMOUNT_MISMATCH" });
  } finally {
    api.restore();
  }
});

test("instalments checkout: upstream 503 INSTALMENTS_DISABLED maps to 503 upstream_unavailable", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": err(503, "INSTALMENTS_DISABLED"),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally {
    api.restore();
  }
});

test("instalments checkout: upstream 429 maps to 429 rate_limited", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": err(429, "RATE_LIMITED"),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", { orderId: ORDER, amount: 19000 }));
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: "rate_limited" });
  } finally {
    api.restore();
  }
});
