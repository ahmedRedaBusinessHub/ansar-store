import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { fetchCurrentSeason, fetchSeasonPassOffer } from "../lib/season-pass-data";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const SEASON = "11111111-1111-4111-8111-111111111111";
const TIER = "22222222-2222-4222-8222-222222222222";
const ok = (data: unknown, status = 200) => ({ status, body: { data, meta: null, error: null } });
const err = (status: number, code: string) => ({ status, body: { data: null, meta: null, error: { code, message: code } } });

function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    const reply = routes[key];
    if (!reply) throw new Error(`unexpected ${key}`);
    return Response.json(reply.body, { status: reply.status });
  });
  return { restore: () => fetchMock.mock.restore() };
}

const tier = { id: TIER, name_ar: "الفئة الذهبية", price: 450, mode: "OPEN", capacity: 0, sold_count: 0, is_full: false, benefits: [] };

test("fetchSeasonPassOffer reads the current season, then its tiers, dropping malformed rows", async () => {
  const api = mockApi({
    "GET /api/v2/seasons/current": ok({ id: SEASON, year: "2026-2027", is_current: true }),
    [`GET /api/v2/seasons/${SEASON}/tiers`]: ok([tier, { id: "bad" }]),
  });
  try {
    const offer = await fetchSeasonPassOffer();
    assert.deepEqual(offer?.season, { id: SEASON, year: "2026-2027" });
    assert.equal(offer?.tiers.length, 1);
    assert.equal(offer?.tiers[0].id, TIER);
  } finally {
    api.restore();
  }
});

test("no current season (404) → null", async () => {
  const api = mockApi({ "GET /api/v2/seasons/current": err(404, "NOT_FOUND") });
  try {
    assert.equal(await fetchCurrentSeason(), null);
    assert.equal(await fetchSeasonPassOffer(), null);
  } finally {
    api.restore();
  }
});

test("other upstream failures throw", async () => {
  const api = mockApi({ "GET /api/v2/seasons/current": err(500, "INTERNAL") });
  try {
    await assert.rejects(fetchCurrentSeason());
  } finally {
    api.restore();
  }
});
