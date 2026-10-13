import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as list } from "../app/api/matches/route";
import { GET as detail } from "../app/api/matches/[id]/route";
import { GET as sections } from "../app/api/matches/[id]/sections/route";
import { fetchMatchDetail } from "../lib/match-data";
import { readStore, resetCatalogCache } from "../lib/catalog";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const M = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const ok = (data: unknown) => ({ status: 200, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push(key);
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (path: string) => new NextRequest(`http://shop.test${path}`);

const ticketedRow = {
  id: M, match_date: "2026-10-18T17:00:00.000Z", opponent: { name_ar: "الهلال", name_en: "Al Hilal", logo: null },
  stadium_ar: "ملعب", stadium_en: "Stadium", competition_ar: null, competition_en: null, club_division: "FIRST_TEAM",
  sales_state: "OPEN", sales_open_at: null, sales_close_at: null, min_price: "100.00",
};
const matchRow = {
  id: M, match_date: "2026-10-18T17:00:00.000Z", opponent_name_ar: "الهلال", opponent_name_en: "Al Hilal",
  opponent_image_url: null, stadium_ar: "ملعب", stadium_en: "Stadium", competition_ar: null, is_alansar_home: true,
};
const salesRow = { is_ticketable: true, is_bookable: true, sales_state: "OPEN", sales_open_at: null, sales_close_at: null, min_price: "100.00" };
const sectionRow = { id: S, match_id: M, name_ar: "المدرج الشرقي", name_en: "East", kind: "GENERAL", venue_section_id: null,
  price: 100, capacity: 500, booked_count: 20, is_full: false, created_at: "2026-10-01T00:00:00.000Z" };

test("GET /api/matches maps the ticketed list and drops malformed rows", async () => {
  const api = mockApi({ "GET /api/v2/matches/ticketed": ok([ticketedRow, { id: "broken" }]) });
  try {
    const response = await list();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.matches.length, 1);
    assert.equal(body.matches[0].id, M);
    assert.equal(body.matches[0].minPrice, 100);
  } finally { api.restore(); }
});

test("GET /api/matches answers 503 when web-api is down", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  try {
    assert.equal((await list()).status, 503);
  } finally { fetchMock.mock.restore(); }
});

test("GET /api/matches/{id} joins detail and sales info", async () => {
  const api = mockApi({
    [`GET /api/v2/matches/${M}/sales-info`]: ok(salesRow),
    [`GET /api/v2/matches/${M}`]: ok(matchRow),
  });
  try {
    const response = await detail(get(`/api/matches/${M}`), ctx(M));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.match.isBookable, true);
    assert.equal(body.match.opponent.nameAr, "الهلال");
    assert.deepEqual(api.calls, [`GET /api/v2/matches/${M}/sales-info`, `GET /api/v2/matches/${M}`]);
  } finally { api.restore(); }
});

test("an unpublished match never calls the detail endpoint", async () => {
  const api = mockApi({ [`GET /api/v2/matches/${M}/sales-info`]: err(404, "NOT_FOUND") });
  try {
    const response = await detail(get(`/api/matches/${M}`), ctx(M));
    assert.equal(response.status, 404);
    assert.deepEqual(api.calls, [`GET /api/v2/matches/${M}/sales-info`]);
  } finally { api.restore(); }
});

test("the ISR page read uses the data cache; the API route stays no-store", async () => {
  const inits: RequestInit[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    inits.push(init);
    return Response.json({ data: new URL(url).pathname.endsWith("/sales-info") ? salesRow : matchRow, meta: null, error: null });
  });
  try {
    assert.notEqual(await fetchMatchDetail(M, { revalidate: 60 }), null);
    resetCatalogCache();
    await readStore({ revalidate: 60 });
    assert.equal(inits.length, 3);
    // A no-store fetch inside a `revalidate` page throws DYNAMIC_SERVER_USAGE → bare 500.
    for (const init of inits) {
      assert.equal(init.cache, undefined);
      assert.deepEqual((init as { next?: unknown }).next, { revalidate: 60 });
    }
    inits.length = 0;
    await detail(get(`/api/matches/${M}`), ctx(M));
    for (const init of inits) assert.equal(init.cache, "no-store");
  } finally { fetchMock.mock.restore(); }
});

test("a malformed id is 404 without any upstream call", async () => {
  const api = mockApi({});
  try {
    assert.equal((await detail(get("/api/matches/nope"), ctx("nope"))).status, 404);
    assert.equal((await sections(get("/api/matches/nope/sections"), ctx("nope"))).status, 404);
    assert.deepEqual(api.calls, []);
  } finally { api.restore(); }
});

test("GET /api/matches/{id}/sections maps sections", async () => {
  const api = mockApi({ [`GET /api/v2/matches/${M}/sections`]: ok([sectionRow]) });
  try {
    const response = await sections(get(`/api/matches/${M}/sections`), ctx(M));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).sections, [{ id: S, name: "المدرج الشرقي", kind: "GENERAL", price: 100, isFull: false, remaining: 480 }]);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { api.restore(); }
});
