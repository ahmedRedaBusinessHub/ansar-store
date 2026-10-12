import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { DELETE as remove, PUT as save } from "../app/api/products/[id]/reviews/mine/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const myRow = { id: "m1", rating: 5, comment: "قماش ممتاز\n\nومقاس مضبوط", status: "PUBLISHED", created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-02T10:00:00.000Z" };

type Call = { key: string; body: unknown; auth: string | null };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>).Authorization ?? null });
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return reply.body === null ? new Response(null, { status: reply.status }) : Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const ok = (data: unknown) => ({ status: 200, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });
const MINE = `/api/v2/store/${PRODUCT}/reviews/mine`;

const putReq = (body: unknown, options: { cookie?: string; type?: string; id?: string } = {}) => {
  const { cookie = "ansar_session=tok", type = "application/json", id = PRODUCT } = options;
  return new NextRequest(`http://shop.test/api/products/${id}/reviews/mine`, {
    method: "PUT",
    headers: { ...(cookie ? { cookie } : {}), "content-type": type },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
};
const deleteReq = (options: { cookie?: string; id?: string } = {}) => {
  const { cookie = "ansar_session=tok", id = PRODUCT } = options;
  return new NextRequest(`http://shop.test/api/products/${id}/reviews/mine`, { method: "DELETE", headers: cookie ? { cookie } : {} });
};

test("PUT guards: non-JSON → 415, signed out → 401, bad id/body → 400, never calling web-api", async () => {
  const api = mockApi({});
  try {
    assert.equal((await save(putReq({ rating: 5 }, { type: "text/plain" }), ctx(PRODUCT))).status, 415);
    const signedOut = await save(putReq({ rating: 5 }, { cookie: "" }), ctx(PRODUCT));
    assert.equal(signedOut.status, 401);
    assert.deepEqual(await signedOut.json(), { error: "unauthenticated" });
    assert.equal((await save(putReq({ rating: 5 }, { id: "nope" }), ctx("nope"))).status, 400);
    for (const body of [{}, { rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: "5" }, { rating: 5, extra: true }, { rating: 5, comment: 7 }, "not json"]) {
      const response = await save(putReq(body), ctx(PRODUCT));
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.deepEqual(await response.json(), { error: "invalid_input" });
    }
    assert.equal(api.calls.length, 0);
  } finally { api.restore(); }
});

test("PUT rejects a too-short or too-long comment locally with 422", async () => {
  const api = mockApi({});
  try {
    const short = await save(putReq({ rating: 4, comment: "جيد" }), ctx(PRODUCT));
    assert.equal(short.status, 422);
    assert.deepEqual(await short.json(), { error: "comment_too_short" });
    const long = await save(putReq({ rating: 4, comment: "ا".repeat(1001) }), ctx(PRODUCT));
    assert.equal(long.status, 422);
    assert.deepEqual(await long.json(), { error: "comment_too_long" });
    assert.equal(api.calls.length, 0);
  } finally { api.restore(); }
});

test("PUT sends the normalized comment with the bearer token and maps the saved review", async () => {
  const api = mockApi({ [`PUT ${MINE}`]: ok(myRow) });
  try {
    const response = await save(putReq({ rating: 5, comment: "  قماش ممتاز\r\n\r\n\r\nومقاس مضبوط  " }), ctx(PRODUCT));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: "m1", rating: 5, comment: "قماش ممتاز\n\nومقاس مضبوط", status: "PUBLISHED", createdAt: myRow.created_at, updatedAt: myRow.updated_at });
    assert.deepEqual(api.calls[0].body, { rating: 5, comment: "قماش ممتاز\n\nومقاس مضبوط" });
    assert.equal(api.calls[0].auth, "Bearer tok");
  } finally { api.restore(); }
});

test("PUT with an empty/blank or missing comment sends comment: null", async () => {
  const api = mockApi({ [`PUT ${MINE}`]: ok({ ...myRow, comment: null }) });
  try {
    assert.equal((await save(putReq({ rating: 3, comment: "   " }), ctx(PRODUCT))).status, 200);
    assert.equal((await save(putReq({ rating: 3 }), ctx(PRODUCT))).status, 200);
    assert.deepEqual(api.calls.map((call) => call.body), [{ rating: 3, comment: null }, { rating: 3, comment: null }]);
  } finally { api.restore(); }
});

test("PUT maps web-api rejections: not a verified buyer, hidden review, expired session", async () => {
  let api = mockApi({ [`PUT ${MINE}`]: err(403, "NOT_VERIFIED_BUYER") });
  try {
    const response = await save(putReq({ rating: 5 }), ctx(PRODUCT));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "not_verified_buyer" });
  } finally { api.restore(); }
  api = mockApi({ [`PUT ${MINE}`]: err(409, "REVIEW_HIDDEN") });
  try {
    const response = await save(putReq({ rating: 5 }), ctx(PRODUCT));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "review_hidden" });
  } finally { api.restore(); }
  api = mockApi({ [`PUT ${MINE}`]: err(401, "UNAUTHORIZED") });
  try {
    const response = await save(putReq({ rating: 5 }), ctx(PRODUCT));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;.*Max-Age=0/i);
  } finally { api.restore(); }
});

test("DELETE: signed out → 401, bad id → 400, success → 204 empty", async () => {
  const api = mockApi({ [`DELETE ${MINE}`]: { status: 204, body: null } });
  try {
    assert.equal((await remove(deleteReq({ cookie: "" }), ctx(PRODUCT))).status, 401);
    assert.equal((await remove(deleteReq({ id: "nope" }), ctx("nope"))).status, 400);
    assert.equal(api.calls.length, 0);
    const response = await remove(deleteReq(), ctx(PRODUCT));
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(api.calls[0].key, `DELETE ${MINE}`);
    assert.equal(api.calls[0].auth, "Bearer tok");
  } finally { api.restore(); }
});

test("DELETE maps missing (404) and hidden (409) reviews", async () => {
  let api = mockApi({ [`DELETE ${MINE}`]: err(404, "REVIEW_NOT_FOUND") });
  try {
    const response = await remove(deleteReq(), ctx(PRODUCT));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  } finally { api.restore(); }
  api = mockApi({ [`DELETE ${MINE}`]: err(409, "REVIEW_HIDDEN") });
  try {
    const response = await remove(deleteReq(), ctx(PRODUCT));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "review_hidden" });
  } finally { api.restore(); }
});
