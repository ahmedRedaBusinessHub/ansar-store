import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as offer } from "../app/api/season-pass/route";
import { GET as seatMap } from "../app/api/season-pass/tiers/[tierId]/seat-map/route";
import { GET as seats } from "../app/api/season-pass/tiers/[tierId]/sections/[sectionId]/seats/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const SEASON = "11111111-1111-4111-8111-111111111111";
const TIER = "22222222-2222-4222-8222-222222222222";
const SECTION = "a0000000-0000-4000-8000-000000000001";
const SEAT = "b0000000-0000-4000-8000-000000000001";
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

type Call = { key: string; auth: string | null };
function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, auth: (init.headers as Record<string, string>).Authorization ?? null });
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { calls, restore: () => fetchMock.mock.restore() };
}
const get = (path: string, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, { headers: { cookie } });
const CURRENT = { "GET /api/v2/seasons/current": ok({ id: SEASON, year: "2026-2027" }) };
const MAP_PATH = `GET /api/v2/seasons/${SEASON}/tiers/${TIER}/seat-map`;
const SEATS_PATH = `GET /api/v2/seasons/${SEASON}/tiers/${TIER}/sections/${SECTION}/seats`;
const mapCtx = { params: Promise.resolve({ tierId: TIER }) };
const seatsCtx = { params: Promise.resolve({ tierId: TIER, sectionId: SECTION }) };

test("GET /api/season-pass returns the offer", async () => {
  const api = mockApi({
    ...CURRENT,
    [`GET /api/v2/seasons/${SEASON}/tiers`]: ok([{ id: TIER, name_ar: "ذهبية", price: 450, mode: "OPEN", capacity: 0, sold_count: 0, is_full: false, benefits: [] }]),
  });
  try {
    const response = await offer();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.offer.season.id, SEASON);
    assert.equal(body.offer.tiers[0].id, TIER);
  } finally {
    api.restore();
  }
});

test("GET /api/season-pass: no current season → { offer: null }; web-api down → 503", async () => {
  let api = mockApi({ "GET /api/v2/seasons/current": err(404, "NOT_FOUND") });
  try {
    assert.deepEqual(await (await offer()).json(), { offer: null });
  } finally {
    api.restore();
  }
  api = mockApi({ "GET /api/v2/seasons/current": err(500, "INTERNAL") });
  try {
    assert.equal((await offer()).status, 503);
  } finally {
    api.restore();
  }
});

test("seat map: session required, tier id validated", async () => {
  assert.equal((await seatMap(get(`/api/season-pass/tiers/${TIER}/seat-map`, ""), mapCtx)).status, 401);
  assert.equal((await seatMap(get("/api/season-pass/tiers/x/seat-map"), { params: Promise.resolve({ tierId: "x" }) })).status, 400);
});

test("seat map: forwards the session and returns the parsed map", async () => {
  const api = mockApi({
    ...CURRENT,
    [MAP_PATH]: ok({
      venue: { id: SEASON, name_ar: "ملعب الأنصار", name_en: "Ansar", pitch_side: null },
      sections: [{ id: SECTION, name_ar: "الشرقي", geo: { x: 10, y: 10, w: 50, h: 20, points: null, color: "#112233" }, tier: { color: "#AA8800" }, counts: { total: 10, available: 4 } }],
      legend: [],
    }),
  });
  try {
    const response = await seatMap(get(`/api/season-pass/tiers/${TIER}/seat-map`), mapCtx);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.map.venueName, "ملعب الأنصار");
    assert.equal(body.map.sections[0].available, 4);
    assert.equal(api.calls.find((c) => c.key === MAP_PATH)?.auth, "Bearer tok");
  } finally {
    api.restore();
  }
});

test("seat map: an OPEN or unknown tier (upstream 404) → 404", async () => {
  const api = mockApi({ ...CURRENT, [MAP_PATH]: err(404, "NOT_FOUND") });
  try {
    assert.equal((await seatMap(get(`/api/season-pass/tiers/${TIER}/seat-map`), mapCtx)).status, 404);
  } finally {
    api.restore();
  }
});

test("seats: returns parsed seats; upstream 401 clears the session", async () => {
  let api = mockApi({
    ...CURRENT,
    [SEATS_PATH]: ok({ section_id: SECTION, seats: [{ id: SEAT, row_label: "A", seat_number: 1, x: 0, y: 0, status: "AVAILABLE", is_accessible: false }] }),
  });
  try {
    const response = await seats(get(`/api/season-pass/tiers/${TIER}/sections/${SECTION}/seats`), seatsCtx);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { seats: [{ id: SEAT, row: "A", number: 1, x: 0, y: 0, status: "AVAILABLE", accessible: false }] });
  } finally {
    api.restore();
  }
  api = mockApi({ ...CURRENT, [SEATS_PATH]: err(401, "UNAUTHORIZED") });
  try {
    const response = await seats(get(`/api/season-pass/tiers/${TIER}/sections/${SECTION}/seats`), seatsCtx);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;/);
  } finally {
    api.restore();
  }
});
