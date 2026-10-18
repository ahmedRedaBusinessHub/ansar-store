import test from "node:test";
import assert from "node:assert/strict";
import {
  formatClock, formatPassSeat, holdSecondsLeft, isUuid, maxPassQuantity, parseTicketCheckoutParams,
  passErrorView, passPayHref, sortPasses, toMySeasonPass, toPassCreated, toSeasonInfo, toSeasonTier,
} from "../lib/season-pass";

const SEASON = "11111111-1111-4111-8111-111111111111";
const TIER = "22222222-2222-4222-8222-222222222222";
const PASS = "33333333-3333-4333-8333-333333333333";
const PASS2 = "44444444-4444-4444-8444-444444444444";
const MATCH = "55555555-5555-4555-8555-555555555555";

const tierRow = (over: Record<string, unknown> = {}) => ({
  id: TIER, season_id: SEASON, name_ar: "الفئة الذهبية", name_en: "Gold", price: 450, capacity: 0, sold_count: 3,
  is_full: false, mode: "OPEN", venue_tier_id: null, seat_summary: null, description_ar: "وصف", description_en: null,
  benefits: [{ label_ar: "المواقف", label_en: "Parking", value_ar: "مجاني", value_en: "Free" }], home_matches_count: 15,
  ...over,
});

test("isUuid", () => {
  assert.equal(isUuid(PASS), true);
  assert.equal(isUuid("x"), false);
  assert.equal(isUuid(5), false);
});

test("toSeasonInfo accepts string or numeric year and rejects bad ids", () => {
  assert.deepEqual(toSeasonInfo({ id: SEASON, year: "2026-2027" }), { id: SEASON, year: "2026-2027" });
  assert.deepEqual(toSeasonInfo({ id: SEASON, year: 2026 }), { id: SEASON, year: "2026" });
  assert.equal(toSeasonInfo({ id: "x", year: "2026" }), null);
  assert.equal(toSeasonInfo(null), null);
});

test("toSeasonTier maps an uncapped OPEN tier (remaining null)", () => {
  assert.deepEqual(toSeasonTier(tierRow()), {
    id: TIER, name: "الفئة الذهبية", price: 450, mode: "OPEN", isFull: false, remaining: null,
    description: "وصف", benefits: [{ label: "المواقف", value: "مجاني" }], homeMatchesCount: 15,
  });
});

test("toSeasonTier: capped OPEN counts places left; SEAT uses seat_summary.available", () => {
  assert.equal(toSeasonTier(tierRow({ capacity: 10, sold_count: 4 }))?.remaining, 6);
  const full = toSeasonTier(tierRow({ capacity: 10, sold_count: 10 }));
  assert.equal(full?.remaining, 0);
  assert.equal(full?.isFull, true);
  const seat = toSeasonTier(tierRow({ mode: "SEAT", seat_summary: { total: 100, taken_by_pass: 10, blocked: 5, available: 85 } }));
  assert.equal(seat?.mode, "SEAT");
  assert.equal(seat?.remaining, 85);
});

test("toSeasonTier rejects malformed rows and drops empty benefits", () => {
  assert.equal(toSeasonTier(tierRow({ id: "bad" })), null);
  assert.equal(toSeasonTier(tierRow({ price: -1 })), null);
  assert.equal(toSeasonTier(tierRow({ mode: "VIP" })), null);
  assert.equal(toSeasonTier(tierRow({ price: "120.50" }))?.price, 120.5);
  assert.deepEqual(toSeasonTier(tierRow({ benefits: [{}, "x"] }))?.benefits, []);
  assert.equal(toSeasonTier(tierRow({ home_matches_count: null }))?.homeMatchesCount, null);
});

test("maxPassQuantity: paid 1, free up to 10, capped by places left", () => {
  assert.equal(maxPassQuantity({ price: 450, remaining: null }), 1);
  assert.equal(maxPassQuantity({ price: 0, remaining: null }), 10);
  assert.equal(maxPassQuantity({ price: 0, remaining: 3 }), 3);
  assert.equal(maxPassQuantity({ price: 0, remaining: 0 }), 1);
});

test("toMySeasonPass maps the seat and hides the QR unless ACTIVE", () => {
  const row = {
    id: PASS, season_id: SEASON, tier_id: TIER, status: "ACTIVE", qr_payload: "abc123", expires_at: null,
    seat: { section_id: "s", section_name_ar: "المدرج الشرقي", section_name_en: "East", row_label: "B", seat_number: 12, gate: "3" },
    tier: { name_ar: "الفئة الذهبية", name_en: "Gold" }, season: { id: SEASON, year: "2026-2027" },
    created_at: "2026-10-14T10:00:00.000Z",
  };
  assert.deepEqual(toMySeasonPass(row), {
    id: PASS, status: "ACTIVE", tierName: "الفئة الذهبية", seasonYear: "2026-2027",
    seat: { sectionName: "المدرج الشرقي", row: "B", number: 12, gate: "3" },
    expiresAt: null, qrPayload: "abc123", createdAt: "2026-10-14T10:00:00.000Z",
  });
  const pending = toMySeasonPass({ ...row, status: "PENDING_PAYMENT", seat: null, expires_at: "2026-10-14T10:10:00.000Z" });
  assert.equal(pending?.qrPayload, null);
  assert.equal(pending?.seat, null);
  assert.equal(pending?.expiresAt, "2026-10-14T10:10:00.000Z");
  assert.equal(toMySeasonPass({ ...row, status: "CANCELLED" }), null);
  assert.equal(toMySeasonPass({ ...row, id: "bad" }), null);
});

test("sortPasses: ACTIVE first, then newest first", () => {
  const list = [
    { id: "a", status: "PENDING_PAYMENT" as const, createdAt: "2026-10-14T09:00:00.000Z" },
    { id: "b", status: "ACTIVE" as const, createdAt: "2026-10-01T09:00:00.000Z" },
    { id: "c", status: "ACTIVE" as const, createdAt: "2026-10-10T09:00:00.000Z" },
  ];
  assert.deepEqual(sortPasses(list).map((p) => p.id), ["c", "b", "a"]);
});

test("formatPassSeat", () => {
  assert.equal(formatPassSeat({ sectionName: "المدرج الشرقي", row: "B", number: 12, gate: "3" }), "المدرج الشرقي · الصف B · المقعد 12 · البوابة 3");
  assert.equal(formatPassSeat({ sectionName: "", row: "B", number: 12, gate: null }), "الصف B · المقعد 12");
});

test("toPassCreated picks the first pass and its hold expiry", () => {
  assert.deepEqual(
    toPassCreated({
      pass_ids: [PASS, PASS2], status: "PENDING_PAYMENT",
      passes: [{ id: PASS, status: "PENDING_PAYMENT", qr_payload: null, expires_at: "2026-10-14T10:10:00.000Z", seat: null }],
    }),
    { passId: PASS, status: "PENDING_PAYMENT", expiresAt: "2026-10-14T10:10:00.000Z" },
  );
  assert.deepEqual(toPassCreated({ pass_ids: [PASS], status: "ACTIVE" }), { passId: PASS, status: "ACTIVE", expiresAt: null });
  assert.equal(toPassCreated({ pass_ids: [], status: "ACTIVE" }), null);
  assert.equal(toPassCreated({ pass_ids: [PASS], status: "WEIRD" }), null);
  assert.equal(toPassCreated(null), null);
});

test("passErrorView maps web-api and BFF codes to Arabic copy", () => {
  assert.equal(passErrorView("SEASON_SEAT_CONFLICT").message, "سبقك أحد إلى هذا المقعد، اختر مقعدًا آخر.");
  assert.equal(passErrorView("SEAT_SELECTION_REQUIRED").reopenSeats, true);
  assert.equal(passErrorView("PAID_QTY_LIMIT").message, "تذكرة واحدة لكل عملية شراء في الفئات المدفوعة.");
  assert.equal(passErrorView("INSUFFICIENT_SLOTS").message, "نفدت الأماكن في هذه الفئة.");
  assert.equal(passErrorView("INVALID_STATE").message, "هذه الفئة غير متاحة الآن.");
  assert.equal(passErrorView("rate_limited").message, "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.");
  assert.equal(passErrorView(undefined).message, "تعذّر إتمام الحجز الآن. حاول بعد قليل.");
});

test("parseTicketCheckoutParams: exactly one of booking / pass", () => {
  const p = (q: string) => parseTicketCheckoutParams(new URLSearchParams(q));
  assert.deepEqual(p(`booking=${PASS}&match=${MATCH}`), { kind: "booking", bookingId: PASS, matchId: MATCH });
  assert.deepEqual(p(`booking=${PASS}`), { kind: "booking", bookingId: PASS, matchId: null });
  assert.deepEqual(p(`booking=${PASS}&match=bad`), { kind: "booking", bookingId: PASS, matchId: null });
  assert.deepEqual(p(`pass=${PASS}`), { kind: "pass", passId: PASS });
  assert.deepEqual(p(`pass=${PASS}&expires=2026-10-14T10:10:00.000Z`), { kind: "pass", passId: PASS });
  assert.equal(p(`booking=${PASS}&pass=${PASS2}`), null);
  assert.equal(p(""), null);
  assert.equal(p("pass=nope"), null);
  assert.equal(p("booking=nope"), null);
});

test("holdSecondsLeft and formatClock", () => {
  const now = Date.parse("2026-10-14T10:00:00.000Z");
  assert.equal(holdSecondsLeft("2026-10-14T10:09:30.000Z", now), 570);
  assert.equal(holdSecondsLeft("2026-10-14T09:00:00.000Z", now), 0);
  assert.equal(holdSecondsLeft(null, now), null);
  assert.equal(holdSecondsLeft("garbage", now), null);
  assert.equal(formatClock(570), "9:30");
  assert.equal(formatClock(5), "0:05");
});

test("passPayHref", () => {
  assert.equal(passPayHref(PASS, null), `/checkout/tickets/pay?pass=${PASS}`);
  assert.equal(passPayHref(PASS, "2026-10-14T10:10:00.000Z"), `/checkout/tickets/pay?pass=${PASS}&expires=2026-10-14T10%3A10%3A00.000Z`);
});

test("parseTicketCheckoutParams: event and event-add kinds", () => {
  const SUB = "66666666-6666-4666-8666-666666666666";
  const PAY = "77777777-7777-4777-8777-777777777777";
  const EV = "88888888-8888-4888-8888-888888888888";
  assert.deepEqual(parseTicketCheckoutParams(new URLSearchParams({ event: SUB, e: EV })), { kind: "event", subscriptionId: SUB, eventId: EV });
  assert.deepEqual(parseTicketCheckoutParams(new URLSearchParams({ event: SUB, add: PAY })), { kind: "event-add", subscriptionId: SUB, paymentId: PAY, eventId: null });
  assert.equal(parseTicketCheckoutParams(new URLSearchParams({ event: SUB, add: "bad" })), null);
  assert.equal(parseTicketCheckoutParams(new URLSearchParams({ event: SUB, pass: SUB })), null);
});

