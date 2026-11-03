import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as eligibility } from "../app/api/payments/instalments/eligibility/route";
import { POST as checkout } from "../app/api/payments/instalments/checkout/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const ORDER = "44444444-4444-4444-8444-444444444444";
const BOOKING = "33333333-3333-4333-8333-333333333333";
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

test("eligibility provider=tabby forwards provider=TABBY, locale=ar and email", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": ok({
      available: true,
      reason: null,
      rejection_reason: null,
      instalments: 4,
      instalment_amount: 4750,
    }),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000&provider=tabby&email=a%40b.co`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: true,
      reason: null,
      rejectionReason: null,
      instalments: 4,
      instalmentAmountHalalah: 4750,
    });
    const call = api.calls[0];
    assert.equal(
      call?.url,
      `http://api.test/api/v2/payments/instalments/eligibility?entity_type=ORDER&entity_id=${ORDER}&amount=19000&currency=SAR&provider=TABBY&locale=ar&email=a%40b.co`,
    );
  } finally {
    api.restore();
  }
});

test("eligibility provider=tabby rejects invalid email with 400 invalid_input", async () => {
  const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000&provider=tabby&email=not-an-email`));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("eligibility provider=tabby maps upstream data to camelCase", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": ok({
      available: false,
      reason: "REJECTED",
      rejection_reason: "order_amount_too_high",
      instalments: null,
      instalment_amount: null,
      currency: null,
    }),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000&provider=tabby`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: false,
      reason: "REJECTED",
      rejectionReason: "order_amount_too_high",
      instalments: null,
      instalmentAmountHalalah: null,
    });
  } finally {
    api.restore();
  }
});

test("eligibility provider=tabby upstream 500 → UNAVAILABLE", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": err(500, "INTERNAL_ERROR"),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?orderId=${ORDER}&amount=19000&provider=tabby`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: false,
      reason: "UNAVAILABLE",
      rejectionReason: null,
      instalments: null,
      instalmentAmountHalalah: null,
    });
  } finally {
    api.restore();
  }
});

test("eligibility bookingId → entity_type=MATCH_BOOKING (tamara)", async () => {
  const api = mockApi({
    "GET /api/v2/payments/instalments/eligibility": ok({ available: true, instalments: 4, instalment_amount: 4750 }),
  });
  try {
    const response = await eligibility(req(`/api/payments/instalments/eligibility?bookingId=${BOOKING}&amount=19000`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      available: true,
      instalments: 4,
      instalmentAmountHalalah: 4750,
    });
    const call = api.calls[0];
    assert.equal(
      call?.url,
      `http://api.test/api/v2/payments/instalments/eligibility?entity_type=MATCH_BOOKING&entity_id=${BOOKING}&amount=19000&currency=SAR`,
    );
  } finally {
    api.restore();
  }
});

test("checkout provider=tabby sends provider TABBY + buyer_email, accepts tabby url", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://checkout.tabby.ai/x",
    }, 201),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", {
      orderId: ORDER,
      amount: 19000,
      provider: "tabby",
      buyerEmail: "a@b.co",
    }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      paymentId: PAYMENT,
      checkoutUrl: "https://checkout.tabby.ai/x",
    });
    const call = api.calls[0];
    assert.deepEqual(call?.body, {
      entity_type: "ORDER",
      entity_id: ORDER,
      amount: 19000,
      currency: "SAR",
      locale: "ar",
      return_channel: "WEB",
      provider: "TABBY",
      buyer_email: "a@b.co",
    });
  } finally {
    api.restore();
  }
});

test("checkout provider=tabby rejects a tamara url (503)", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://checkout.tamara.co/x",
    }),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", {
      orderId: ORDER,
      amount: 19000,
      provider: "tabby",
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally {
    api.restore();
  }
});

test("provider tamara rejects a tabby url (503)", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://checkout.tabby.ai/x",
    }),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", {
      orderId: ORDER,
      amount: 19000,
      provider: "tamara",
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally {
    api.restore();
  }
});

test("checkout tabby INSTALMENTS_REJECTED → 409 with rejectionReason", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": {
      status: 409,
      body: {
        data: null,
        meta: null,
        error: {
          code: "INSTALMENTS_REJECTED",
          message: "INSTALMENTS_REJECTED",
          details: { rejection_reason: "not_available" },
        },
      },
    },
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", {
      orderId: ORDER,
      amount: 19000,
      provider: "tabby",
    }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "order_rejected",
      code: "INSTALMENTS_REJECTED",
      rejectionReason: "not_available",
    });
  } finally {
    api.restore();
  }
});

test("checkout invalid buyerEmail → 400", async () => {
  const response = await checkout(req("/api/payments/instalments/checkout", {
    orderId: ORDER,
    amount: 19000,
    provider: "tabby",
    buyerEmail: "invalid-email",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("checkout bookingId (tamara) → entity_type MATCH_BOOKING", async () => {
  const api = mockApi({
    "POST /api/v2/payments/instalments/checkout": ok({
      payment_id: PAYMENT,
      checkout_url: "https://checkout-sandbox.tamara.co/abc",
    }, 201),
  });
  try {
    const response = await checkout(req("/api/payments/instalments/checkout", {
      bookingId: BOOKING,
      amount: 19000,
    }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      paymentId: PAYMENT,
      checkoutUrl: "https://checkout-sandbox.tamara.co/abc",
    });
    const call = api.calls[0];
    assert.deepEqual(call?.body, {
      entity_type: "MATCH_BOOKING",
      entity_id: BOOKING,
      amount: 19000,
      currency: "SAR",
      locale: "ar",
      return_channel: "WEB",
    });
  } finally {
    api.restore();
  }
});
