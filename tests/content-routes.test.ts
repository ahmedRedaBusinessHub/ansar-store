import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET as newsStrip } from "../app/api/news/route";
import { GET as galleryStrip } from "../app/api/gallery/route";
import { fetchMediaItem, fetchMediaPage } from "../lib/media-data";
import { fetchNewsItem, fetchNewsPage } from "../lib/news-data";
import { UpstreamError } from "../lib/upstream";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const P = "11111111-1111-4111-8111-111111111111";
const V = "22222222-2222-4222-8222-222222222222";
const page = (data: unknown[], meta = { page: 1, totalCount: data.length, pagesCount: 1 }) => ({ status: 200, body: { data, meta, error: null } });
const one = (data: unknown) => ({ status: 200, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

const newsRow = { id: "4521", title_ar: "خبر", description_ar: "<p>نص</p>", image_url: null, is_important: false, created_at: "2026-10-01T00:00:00.000Z" };
const photoRow = { id: P, media_type: "PHOTO", image_url: "/uploads/a.webp", thumbnail_url: null, caption_ar: null, category: "GENERAL", created_at: "2026-10-01T00:00:00.000Z", video_url: null, video_duration_seconds: null };
const videoRow = { ...photoRow, id: V, media_type: "VIDEO", video_url: "/uploads/v.mp4", video_duration_seconds: 30 };

/** Keys are pathname + search, so tests pin the exact query sent to web-api. */
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string) => {
    const parsed = new URL(url);
    const key = `${parsed.pathname}${parsed.search}`;
    calls.push(key);
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}

function apiDown() {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  return { restore: () => fetchMock.mock.restore() };
}

test("GET /api/news returns three cards without article bodies", async () => {
  const api = mockApi({ "/api/v2/news?page=1&perPage=3": page([newsRow, { id: "bad/id", title_ar: "x" }]) });
  try {
    const response = await newsStrip();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    const body = await response.json();
    assert.equal(body.news.length, 1);
    assert.equal(body.news[0].id, "4521");
    assert.equal("html" in body.news[0], false);
    assert.deepEqual(api.calls, ["/api/v2/news?page=1&perPage=3"]);
  } finally { api.restore(); }
});

test("GET /api/gallery returns photos and videos together", async () => {
  const api = mockApi({ "/api/v2/gallery?page=1&perPage=6": page([photoRow, videoRow]) });
  try {
    const body = await (await galleryStrip()).json();
    assert.deepEqual(body.items.map((item: { kind: string }) => item.kind), ["photo", "video"]);
  } finally { api.restore(); }
});

test("both proxies answer 503 when web-api is down", async () => {
  const down = apiDown();
  try {
    assert.equal((await newsStrip()).status, 503);
    assert.equal((await galleryStrip()).status, 503);
  } finally { down.restore(); }
});

test("fetchNewsPage sends the page, size and important filter and reads meta", async () => {
  const api = mockApi({
    "/api/v2/news?page=2&perPage=12": page([newsRow], { page: 2, totalCount: 13, pagesCount: 2 }),
    "/api/v2/news?page=1&perPage=5&important=true": page([]),
  });
  try {
    const list = await fetchNewsPage(2);
    assert.deepEqual({ page: list.page, pagesCount: list.pagesCount, totalCount: list.totalCount, count: list.items.length }, { page: 2, pagesCount: 2, totalCount: 13, count: 1 });
    assert.equal((await fetchNewsPage(1, { important: true, perPage: 5 })).items.length, 0);
  } finally { api.restore(); }
});

test("fetchNewsItem: bad id and 404 → null, 5xx → throws", async () => {
  const api = mockApi({
    "/api/v2/news/4521": one(newsRow),
    "/api/v2/news/9999": err(404, "NOT_FOUND"),
    "/api/v2/news/500": err(500, "INTERNAL_SERVER_ERROR"),
  });
  try {
    assert.equal((await fetchNewsItem("4521"))?.title, "خبر");
    assert.equal(await fetchNewsItem("9999"), null);
    assert.equal(await fetchNewsItem("../x"), null);
    await assert.rejects(fetchNewsItem("500"), (error) => error instanceof UpstreamError && error.status === 500);
    assert.deepEqual(api.calls, ["/api/v2/news/4521", "/api/v2/news/9999", "/api/v2/news/500"]);
  } finally { api.restore(); }
});

test("fetchMediaPage sends media type, category and page", async () => {
  const api = mockApi({ "/api/v2/gallery?page=2&perPage=24&media_type=VIDEO&category=EVENTS": page([videoRow, photoRow]) });
  try {
    const list = await fetchMediaPage("video", { category: "EVENTS", page: 2 });
    assert.deepEqual(list.items.map((item) => item.id), [V]); // a photo in a video list is dropped
  } finally { api.restore(); }
});

test("fetchMediaItem: wrong kind, bad id and 404 → null; 503 → throws", async () => {
  const api = mockApi({
    [`/api/v2/gallery/${P}`]: one(photoRow),
    [`/api/v2/gallery/${V}`]: err(404, "NOT_FOUND"),
  });
  try {
    assert.equal((await fetchMediaItem("photo", P))?.kind, "photo");
    assert.equal(await fetchMediaItem("video", P), null);
    assert.equal(await fetchMediaItem("video", V), null);
    assert.equal(await fetchMediaItem("photo", "nope"), null);
  } finally { api.restore(); }
  const down = apiDown();
  try {
    await assert.rejects(fetchMediaItem("photo", P), (error) => error instanceof UpstreamError && error.status === 503);
  } finally { down.restore(); }
});
