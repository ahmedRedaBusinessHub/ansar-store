import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { deleteMyReview, fetchReviewPage, fetchReviewSummary, saveMyReview } from "../lib/reviews-client";

const ID = "11111111-1111-4111-8111-111111111111";
type Seen = { url: string; init: RequestInit };
function mockFetch(reply: () => Response) {
  const seen: Seen[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return reply();
  });
  return { seen, restore: () => fetchMock.mock.restore() };
}

test("fetchReviewSummary GETs the summary route without caching", async () => {
  const summary = { average: 4.5, count: 2, canReview: true, myReview: null };
  const api = mockFetch(() => Response.json(summary));
  try {
    assert.deepEqual(await fetchReviewSummary(ID), { ok: true, data: summary });
    assert.equal(api.seen[0].url, `/api/products/${ID}/reviews/summary`);
    assert.equal(api.seen[0].init.cache, "no-store");
    assert.equal(api.seen[0].init.method, undefined);
  } finally { api.restore(); }
});

test("fetchReviewPage sends sort + page", async () => {
  const page = { reviews: [], page: 2, pages: 3, total: 11 };
  const api = mockFetch(() => Response.json(page));
  try {
    assert.deepEqual(await fetchReviewPage(ID, "lowest", 2), { ok: true, data: page });
    assert.equal(api.seen[0].url, `/api/products/${ID}/reviews?sort=lowest&page=2`);
  } finally { api.restore(); }
});

test("saveMyReview PUTs JSON", async () => {
  const saved = { id: "m1", rating: 5, comment: null, status: "PUBLISHED", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" };
  const api = mockFetch(() => Response.json(saved));
  try {
    assert.deepEqual(await saveMyReview(ID, { rating: 5, comment: null }), { ok: true, data: saved });
    assert.equal(api.seen[0].url, `/api/products/${ID}/reviews/mine`);
    assert.equal(api.seen[0].init.method, "PUT");
    assert.deepEqual(api.seen[0].init.headers, { "Content-Type": "application/json" });
    assert.equal(api.seen[0].init.body, JSON.stringify({ rating: 5, comment: null }));
  } finally { api.restore(); }
});

test("deleteMyReview DELETEs and treats 204 as success", async () => {
  const api = mockFetch(() => new Response(null, { status: 204 }));
  try {
    assert.deepEqual(await deleteMyReview(ID), { ok: true, data: null });
    assert.equal(api.seen[0].url, `/api/products/${ID}/reviews/mine`);
    assert.equal(api.seen[0].init.method, "DELETE");
  } finally { api.restore(); }
});

test("error bodies come back as { ok: false, status, error }", async () => {
  let api = mockFetch(() => Response.json({ error: "not_verified_buyer" }, { status: 403 }));
  try {
    assert.deepEqual(await saveMyReview(ID, { rating: 4, comment: null }), { ok: false, status: 403, error: "not_verified_buyer" });
  } finally { api.restore(); }
  api = mockFetch(() => Response.json({ error: "unauthenticated" }, { status: 401 }));
  try {
    assert.deepEqual(await saveMyReview(ID, { rating: 4, comment: null }), { ok: false, status: 401, error: "unauthenticated" });
  } finally { api.restore(); }
  api = mockFetch(() => new Response("<html>", { status: 500 }));
  try {
    assert.deepEqual(await fetchReviewSummary(ID), { ok: false, status: 500, error: "upstream_unavailable" });
  } finally { api.restore(); }
});

test("network failure → upstream_unavailable; aborted signal → aborted", async () => {
  let fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  try {
    assert.deepEqual(await fetchReviewSummary(ID), { ok: false, status: 0, error: "upstream_unavailable" });
  } finally { fetchMock.mock.restore(); }
  const controller = new AbortController();
  controller.abort();
  fetchMock = mock.method(globalThis, "fetch", async () => { throw new DOMException("aborted", "AbortError"); });
  try {
    assert.deepEqual(await fetchReviewPage(ID, "recent", 1, controller.signal), { ok: false, status: 0, error: "aborted" });
  } finally { fetchMock.mock.restore(); }
});
