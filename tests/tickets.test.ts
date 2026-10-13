import test from "node:test";
import assert from "node:assert/strict";
import { toTicketBooking, visibleBookings, type TicketBooking } from "../lib/tickets";
import { qrSvg } from "../lib/qr";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const row = {
  id: "b1", matchId: "m1", sectionId: "s1", quantity: 2, status: "CONFIRMED",
  match: { id: "m1", stadium: { ar: "ملعب الأنصار", en: "Ansar Stadium" }, date: "2026-10-18T17:00:00.000Z", isHome: true,
    opponent: { name: { ar: "الهلال", en: "Al Hilal" }, logo: "/uploads/hilal.png" } },
  section: { id: "s1", name: { ar: "المدرج الشرقي", en: "East" }, price: 100 },
  tickets: [
    { id: "t1", number: 1, status: "UNUSED", qrPayload: "QR-1" },
    { id: "t2", number: 2, status: "CANCELLED", qrPayload: "QR-2" },
  ],
  createdAt: "2026-10-12T10:00:00.000Z",
};

test("toTicketBooking maps the v2 booking and drops cancelled tickets", () => {
  assert.deepEqual(toTicketBooking(row), {
    id: "b1", status: "CONFIRMED", quantity: 2, matchId: "m1", date: "2026-10-18T17:00:00.000Z", isHome: true,
    opponentNameAr: "الهلال", opponentLogo: "http://api.test/uploads/hilal.png", stadiumAr: "ملعب الأنصار",
    sectionNameAr: "المدرج الشرقي", unitPrice: 100,
    tickets: [{ id: "t1", number: 1, status: "UNUSED", qrPayload: "QR-1" }],
  });
  assert.equal(toTicketBooking({ ...row, match: null }), null);
  assert.equal(toTicketBooking({ ...row, status: "WEIRD" }), null);
  const pending = toTicketBooking({ ...row, status: "PENDING_PAYMENT", tickets: undefined, section: null });
  assert.equal(pending?.tickets.length, 0);
  assert.equal(pending?.sectionNameAr, "");
  assert.equal(pending?.unitPrice, null);
});

test("visibleBookings: upcoming soonest first, then past latest first; hides cancelled and stale pending", () => {
  const base = toTicketBooking(row) as TicketBooking;
  const at = (id: string, date: string, status: TicketBooking["status"]): TicketBooking => ({ ...base, id, date, status });
  const now = new Date("2026-10-12T00:00:00.000Z");
  const list = [
    at("past-late", "2026-10-01T17:00:00.000Z", "CONFIRMED"),
    at("future-far", "2026-11-01T17:00:00.000Z", "CONFIRMED"),
    at("future-near", "2026-10-15T17:00:00.000Z", "PENDING_PAYMENT"),
    at("past-early", "2026-09-01T17:00:00.000Z", "CONFIRMED"),
    at("cancelled", "2026-10-20T17:00:00.000Z", "CANCELLED"),
    at("stale-pending", "2026-10-05T17:00:00.000Z", "PENDING_PAYMENT"),
  ];
  assert.deepEqual(visibleBookings(list, now).map((b) => b.id), ["future-near", "future-far", "past-late", "past-early"]);
});

test("qrSvg renders an SVG", async () => {
  const svg = await qrSvg("ANSAR-TICKET-123");
  assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/);
});
