import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as list } from "../app/api/products/[id]/reviews/route";
import { GET as summary } from "../app/api/products/[id]/reviews/summary/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (path: string, cookie = "") => new NextRequest(`http://shop.test${path}`, { headers: cookie ? { cookie } : {} });
const reviewRow = {
  id: "r1", rating: 4, comment: "جودة ممتازة", reviewer_name: "أحمد م.",
  created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-01T10:00:00.000Z", is_mine: true,
};

type Call = { url: URL; method: string; auth: string | null };
function mockApi(reply: () => Response) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: new URL(url), method: init.method ?? "GET", auth: (init.headers as Record<string, string>).Authorization ?? null });
    return reply();
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const envelope = (data: unknown, meta: unknown = null) => Response.json({ data, meta, error: null });
const failure = (status: number, code: string) => Response.json({ data: null, meta: null, error: { code, message: code } }, { status });

test("list forwards sort/page/perPage + the session token and maps rows", async () => {
  const api = mockApi(() => envelope([reviewRow, { id: "broken" }], { page: 2, totalCount: 7, pagesCount: 2 }));
  try {
    const response = await list(req(`/api/products/${PRODUCT}/reviews?sort=highest&page=2`, "ansar_session=tok"), ctx(PRODUCT));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reviews: [{ id: "r1", rating: 4, comment: "جودة ممتازة", reviewerName: "أحمد م.", createdAt: reviewRow.created_at, updatedAt: reviewRow.updated_at, isMine: true }],
      page: 2, pages: 2, total: 7,
    });
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0].method, "GET");
    assert.equal(api.calls[0].url.pathname, `/api/v2/store/${PRODUCT}/reviews`);
    assert.equal(api.calls[0].url.searchParams.get("sort"), "highest");
    assert.equal(api.calls[0].url.searchParams.get("page"), "2");
    assert.equal(api.calls[0].url.searchParams.get("perPage"), "5");
    assert.equal(api.calls[0].auth, "Bearer tok");
  } finally { api.restore(); }
});

test("list defaults to sort=recent&page=1 and sends no token when signed out", async () => {
  const api = mockApi(() => envelope([], { page: 1, totalCount: 0, pagesCount: 0 }));
  try {
    const response = await list(req(`/api/products/${PRODUCT}/reviews`), ctx(PRODUCT));
    assert.deepEqual(await response.json(), { reviews: [], page: 1, pages: 0, total: 0 });
    assert.equal(api.calls[0].url.searchParams.get("sort"), "recent");
    assert.equal(api.calls[0].url.searchParams.get("page"), "1");
    assert.equal(api.calls[0].auth, null);
  } finally { api.restore(); }
});

test("list rejects a bad id, sort or page with 400 without calling web-api", async () => {
  const api = mockApi(() => envelope([]));
  try {
    const cases: [string, string][] = [
      ["nope", ""], [PRODUCT, "?sort=best"], [PRODUCT, "?page=0"], [PRODUCT, "?page=abc"], [PRODUCT, "?page=99999"], [PRODUCT, "?page=-1"],
    ];
    for (const [id, query] of cases) {
      const response = await list(req(`/api/products/${id}/reviews${query}`), ctx(id));
      assert.equal(response.status, 400, `${id}${query}`);
      assert.deepEqual(await response.json(), { error: "invalid_input" });
    }
    assert.equal(api.calls.length, 0);
  } finally { api.restore(); }
});

test("list: unknown product → 404 not_found; web-api down → 503", async () => {
  let api = mockApi(() => failure(404, "PRODUCT_NOT_FOUND"));
  try {
    const response = await list(req(`/api/products/${PRODUCT}/reviews`), ctx(PRODUCT));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  } finally { api.restore(); }
  api = mockApi(() => { throw new TypeError("fetch failed"); });
  try {
    const response = await list(req(`/api/products/${PRODUCT}/reviews`), ctx(PRODUCT));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally { api.restore(); }
});

test("summary maps avg/count/can_review/my_review and passes the token", async () => {
  const myReview = { id: "m1", rating: 5, comment: "ممتاز جدًا", status: "PUBLISHED", created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-01T10:00:00.000Z" };
  const api = mockApi(() => envelope({ avg_rating: 4.5, reviews_count: 2, can_review: true, my_review: myReview }));
  try {
    const response = await summary(req(`/api/products/${PRODUCT}/reviews/summary`, "ansar_session=tok"), ctx(PRODUCT));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      average: 4.5, count: 2, canReview: true,
      myReview: { id: "m1", rating: 5, comment: "ممتاز جدًا", status: "PUBLISHED", createdAt: myReview.created_at, updatedAt: myReview.updated_at },
    });
    assert.equal(api.calls[0].url.pathname, `/api/v2/store/${PRODUCT}/reviews/summary`);
    assert.equal(api.calls[0].auth, "Bearer tok");
  } finally { api.restore(); }
});

test("summary: bad id → 400; malformed web-api data → 503; unknown product → 404", async () => {
  let api = mockApi(() => envelope({ avg_rating: "x" }));
  try {
    assert.equal((await summary(req("/api/products/nope/reviews/summary"), ctx("nope"))).status, 400);
    assert.equal(api.calls.length, 0);
    const response = await summary(req(`/api/products/${PRODUCT}/reviews/summary`), ctx(PRODUCT));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally { api.restore(); }
  api = mockApi(() => failure(404, "PRODUCT_NOT_FOUND"));
  try {
    assert.equal((await summary(req(`/api/products/${PRODUCT}/reviews/summary`), ctx(PRODUCT))).status, 404);
  } finally { api.restore(); }
});
