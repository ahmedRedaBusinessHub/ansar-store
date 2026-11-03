import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET as tabbyConfig } from "../app/api/tabby-config/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";

type Call = {
  url: string;
  path: string;
  key: string;
  body: unknown;
  auth: string | null;
  next?: { revalidate?: number };
};

function mockApi(routes: Record<string, { status: number; body: unknown } | (() => Response)>) {
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
      next: (init as unknown as { next?: { revalidate?: number } })?.next,
    });
    const handler = routes[fullKey] ?? routes[key];
    if (!handler) throw new Error(`unexpected fetch to ${key} (${path})`);
    if (typeof handler === "function") return handler();
    return Response.json(handler.body, { status: handler.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}

test("enabled with keys", async () => {
  const api = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        tabby_enabled: true,
        tabby_public_key: "pk_test_123",
        tabby_merchant_code: "merchant_code_456",
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: true,
      publicKey: "pk_test_123",
      merchantCode: "merchant_code_456",
    });
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0]?.path, "/api/v2/app-config");
    assert.equal(api.calls[0]?.next?.revalidate, 60);
  } finally {
    api.restore();
  }
});

test("enabled with keys (wrapped in data envelope)", async () => {
  const api = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        data: {
          tabby_enabled: true,
          tabby_public_key: "pk_env_123",
          tabby_merchant_code: "merchant_env_456",
        },
        meta: null,
        error: null,
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: true,
      publicKey: "pk_env_123",
      merchantCode: "merchant_env_456",
    });
  } finally {
    api.restore();
  }
});

test("flag off → enabled false, keys null", async () => {
  const api = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        tabby_enabled: false,
        tabby_public_key: "pk_test_123",
        tabby_merchant_code: "merchant_code_456",
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: false,
      publicKey: null,
      merchantCode: null,
    });
  } finally {
    api.restore();
  }
});

test("missing key → enabled false", async () => {
  // Empty public key
  const api1 = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        tabby_enabled: true,
        tabby_public_key: "",
        tabby_merchant_code: "merchant_code_456",
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: false,
      publicKey: null,
      merchantCode: null,
    });
  } finally {
    api1.restore();
  }

  // Missing merchant code
  const api2 = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        tabby_enabled: true,
        tabby_public_key: "pk_test_123",
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: false,
      publicKey: null,
      merchantCode: null,
    });
  } finally {
    api2.restore();
  }
});

test("upstream error → enabled false", async () => {
  // Upstream 500 HTTP error
  const api1 = mockApi({
    "GET /api/v2/app-config": {
      status: 500,
      body: { error: { code: "INTERNAL_ERROR" } },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: false,
      publicKey: null,
      merchantCode: null,
    });
  } finally {
    api1.restore();
  }

  // Upstream network failure
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Network connection failed");
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: false,
      publicKey: null,
      merchantCode: null,
    });
  } finally {
    fetchMock.mock.restore();
  }
});

test("never forwards any key starting with sk_", async () => {
  const api = mockApi({
    "GET /api/v2/app-config": {
      status: 200,
      body: {
        tabby_enabled: true,
        tabby_public_key: "pk_test_123",
        tabby_merchant_code: "merchant_code_456",
        tabby_secret: "sk_live_x",
      },
    },
  });
  try {
    const response = await tabbyConfig();
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes("sk_"), false);
    assert.equal(text.includes("sk_live_x"), false);
    const parsed = JSON.parse(text);
    assert.deepEqual(parsed, {
      enabled: true,
      publicKey: "pk_test_123",
      merchantCode: "merchant_code_456",
    });
    assert.equal("tabby_secret" in parsed, false);
  } finally {
    api.restore();
  }
});
