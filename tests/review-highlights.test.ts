import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/reviews/highlights/route";
import { fetchReviewHighlights, resetHighlightsCache, toReviewHighlight } from "../lib/review-highlights";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "r1", rating: 5, comment: "قماش ممتاز ومقاس مضبوط", reviewer_name: "أحمد م.", created_at: "2026-10-01T10:00:00.000Z",
  product: { id: PRODUCT, name_ar: "قميص", name_en: "Shirt", image_url: null },
};
const mapped = { id: "r1", rating: 5, comment: "قماش ممتاز ومقاس مضبوط", reviewerName: "أحمد م.", createdAt: "2026-10-01T10:00:00.000Z", productId: PRODUCT };

type Call = { url: URL; auth: string | null };
function mockApi(reply: () => Response) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: new URL(url), auth: (init.headers as Record<string, string>).Authorization ?? null });
    return reply();
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const envelope = (data: unknown) => Response.json({ data, meta: null, error: null });

test("toReviewHighlight maps a row and rejects malformed ones", () => {
  assert.deepEqual(toReviewHighlight(row), mapped);
  assert.deepEqual(toReviewHighlight({ ...row, reviewer_name: null }), { ...mapped, reviewerName: null });
  assert.equal(toReviewHighlight({ ...row, rating: 6 }), null);
  assert.equal(toReviewHighlight({ ...row, comment: "" }), null);
  assert.equal(toReviewHighlight({ ...row, product: null }), null);
  assert.equal(toReviewHighlight(null), null);
});

test("fetchReviewHighlights calls web-api without a token, drops broken rows and caches for 5 minutes", async () => {
  resetHighlightsCache();
  const api = mockApi(() => envelope([row, { id: "broken" }]));
  try {
    assert.deepEqual(await fetchReviewHighlights(), [mapped]);
    assert.deepEqual(await fetchReviewHighlights(), [mapped]);
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0].url.pathname, "/api/v2/store/reviews/highlights");
    assert.equal(api.calls[0].url.searchParams.get("limit"), "8");
    assert.equal(api.calls[0].auth, null);
  } finally { api.restore(); }
});

test("an expired cache refetches; a failing web-api then serves the stale list", async () => {
  resetHighlightsCache();
  let now = 1_000_000;
  const clock = mock.method(Date, "now", () => now);
  let api = mockApi(() => envelope([row]));
  try {
    assert.deepEqual(await fetchReviewHighlights(), [mapped]);
  } finally { api.restore(); }
  now += 5 * 60_000 + 1;
  api = mockApi(() => { throw new TypeError("fetch failed"); });
  try {
    assert.deepEqual(await fetchReviewHighlights(), [mapped]);
    assert.equal(api.calls.length, 1);
  } finally { api.restore(); clock.mock.restore(); }
});

test("GET returns { reviews }; an older web-api (404) means an empty list; other failures → 503", async () => {
  resetHighlightsCache();
  let api = mockApi(() => envelope([row]));
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reviews: [mapped] });
  } finally { api.restore(); }
  resetHighlightsCache();
  api = mockApi(() => Response.json({ data: null, meta: null, error: { code: "NOT_FOUND", message: "x" } }, { status: 404 }));
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reviews: [] });
  } finally { api.restore(); }
  resetHighlightsCache();
  api = mockApi(() => new Response("<html>", { status: 500 }));
  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
  } finally { api.restore(); }
});
