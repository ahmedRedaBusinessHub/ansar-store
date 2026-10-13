import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as list } from "../app/api/tickets/route";
import { GET as pdf } from "../app/api/tickets/[id]/pdf/route";
import { GET as apple } from "../app/api/tickets/[id]/wallet/apple/route";
import { GET as google } from "../app/api/tickets/[id]/wallet/google/route";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const T = "77777777-7777-4777-8777-777777777777";
const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const booking = (id: string, status: string) => ({
  id, matchId: "m1", sectionId: "s1", quantity: 1, status,
  match: { id: "m1", stadium: { ar: "ملعب", en: "Stadium" }, date: future, isHome: true, opponent: { name: { ar: "الهلال", en: "Al Hilal" }, logo: null } },
  section: { id: "s1", name: { ar: "الشرقي", en: "East" }, price: 100 },
  tickets: status === "CONFIRMED" ? [{ id: T, number: 1, status: "UNUSED", qrPayload: "QR-1" }] : [],
  createdAt: "2026-10-12T10:00:00.000Z",
});
const get = (path: string, cookie = "ansar_session=tok") => new NextRequest(`http://shop.test${path}`, { headers: { cookie } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function mockFetch(handler: (path: string, init: RequestInit) => Response) {
  const paths: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname + new URL(url).search;
    paths.push(path);
    return handler(path, init);
  });
  return { paths, restore: () => fetchMock.mock.restore() };
}

test("tickets list needs a session", async () => {
  assert.equal((await list(get("/api/tickets", ""))).status, 401);
});

test("tickets list renders QR SVGs and never returns raw payloads", async () => {
  const api = mockFetch(() => Response.json({ data: [booking("b1", "CONFIRMED"), booking("b2", "CANCELLED")], meta: null }));
  try {
    const response = await list(get("/api/tickets"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.bookings.map((b: { id: string }) => b.id), ["b1"]);
    assert.match(body.bookings[0].tickets[0].qrSvg, /^<svg/);
    assert.equal(JSON.stringify(body).includes("QR-1"), false);
    assert.deepEqual(api.paths, ["/api/v2/match-bookings?my=1"]);
  } finally { api.restore(); }
});

test("tickets list can return one booking, whatever its status", async () => {
  const api = mockFetch(() => Response.json({ data: [booking("b1", "CONFIRMED"), booking("b2", "PENDING_PAYMENT")], meta: null }));
  try {
    const body = await (await list(get("/api/tickets?booking=b2"))).json();
    assert.deepEqual(body.bookings.map((b: { id: string }) => b.id), ["b2"]);
  } finally { api.restore(); }
});

test("an expired session clears the cookie", async () => {
  const api = mockFetch(() => Response.json({ data: null, meta: null, error: { code: "UNAUTHORIZED", message: "x" } }, { status: 401 }));
  try {
    const response = await list(get("/api/tickets"));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /ansar_session=;/);
  } finally { api.restore(); }
});

test("PDF streams through with a download name; foreign tickets are 404", async () => {
  let api = mockFetch(() => new Response("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } }));
  try {
    const response = await pdf(get(`/api/tickets/${T}/pdf`), ctx(T));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="alansar-ticket.pdf"/);
    assert.equal(await response.text(), "%PDF-1.7");
  } finally { api.restore(); }
  api = mockFetch(() => Response.json({ data: null, meta: null, error: { code: "FORBIDDEN", message: "x" } }, { status: 403 }));
  try {
    assert.equal((await pdf(get(`/api/tickets/${T}/pdf`), ctx(T))).status, 404);
  } finally { api.restore(); }
  assert.equal((await pdf(get("/api/tickets/nope/pdf"), ctx("nope"))).status, 404);
});

test("Apple Wallet streams the pass, or redirects to the PDF when wallet is not configured", async () => {
  let api = mockFetch(() => new Response("PK", { status: 200, headers: { "content-type": "application/vnd.apple.pkpass" } }));
  try {
    const response = await apple(get(`/api/tickets/${T}/wallet/apple`), ctx(T));
    assert.equal(response.headers.get("content-type"), "application/vnd.apple.pkpass");
  } finally { api.restore(); }
  api = mockFetch(() => Response.json({ data: { fallback: "pdf", url: `/api/v2/tickets/${T}/pdf` }, meta: null, error: null }));
  try {
    const response = await apple(get(`/api/tickets/${T}/wallet/apple`), ctx(T));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `/api/tickets/${T}/pdf`);
  } finally { api.restore(); }
});

test("Google Wallet redirects to Google's save URL only, else to the PDF", async () => {
  let api = mockFetch(() => Response.json({ data: { save_url: "https://pay.google.com/gp/v/save/abc" }, meta: null, error: null }));
  try {
    const response = await google(get(`/api/tickets/${T}/wallet/google`), ctx(T));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://pay.google.com/gp/v/save/abc");
  } finally { api.restore(); }
  api = mockFetch(() => Response.json({ data: { save_url: "https://evil.example/x" }, meta: null, error: null }));
  try {
    assert.equal((await google(get(`/api/tickets/${T}/wallet/google`), ctx(T))).headers.get("location"), `/api/tickets/${T}/pdf`);
  } finally { api.restore(); }
});
