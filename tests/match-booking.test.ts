import test from "node:test";
import assert from "node:assert/strict";
import { bookingErrorView, bookingUpstream, MAX_TICKETS_PER_MATCH, toBookingCreated } from "../lib/match-booking";
import { createWindowLimiter } from "../lib/rate-window";

const M = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";

test("GENERAL sections book by quantity; SEATED sections use best-available", () => {
  assert.equal(MAX_TICKETS_PER_MATCH, 10);
  assert.deepEqual(bookingUpstream("GENERAL", M, S, 3), { path: "/api/v2/match-bookings", body: { match_id: M, section_id: S, quantity: 3 } });
  assert.deepEqual(bookingUpstream("SEATED", M, S, 3), { path: `/api/v2/matches/${M}/best-available`, body: { section_id: S, quantity: 3 } });
});

test("toBookingCreated reads the GENERAL shape", () => {
  assert.deepEqual(toBookingCreated("GENERAL", { booking: { id: "b1", status: "PENDING_PAYMENT" } }, false),
    { bookingId: "b1", status: "PENDING_PAYMENT", expiresAt: null });
  assert.deepEqual(toBookingCreated("GENERAL", { booking: { id: "b1", status: "CONFIRMED" } }, true),
    { bookingId: "b1", status: "CONFIRMED", expiresAt: null });
  assert.equal(toBookingCreated("GENERAL", { booking: { id: "b1", status: "CANCELLED" } }, false), null);
  assert.equal(toBookingCreated("GENERAL", { booking: { status: "PENDING_PAYMENT" } }, false), null);
  assert.equal(toBookingCreated("GENERAL", null, false), null);
});

test("toBookingCreated reads the SEATED shape; a free seated booking is confirmed with no hold", () => {
  const body = { data: { booking_id: "b2", expires_at: "2026-10-12T12:10:00.000Z", held_seats: ["s1"] } };
  assert.deepEqual(toBookingCreated("SEATED", body, false), { bookingId: "b2", status: "PENDING_PAYMENT", expiresAt: "2026-10-12T12:10:00.000Z" });
  assert.deepEqual(toBookingCreated("SEATED", body, true), { bookingId: "b2", status: "CONFIRMED", expiresAt: null });
  assert.deepEqual(toBookingCreated("SEATED", { data: { booking_id: "b2", expires_at: "garbage" } }, false),
    { bookingId: "b2", status: "PENDING_PAYMENT", expiresAt: null });
  assert.equal(toBookingCreated("SEATED", { data: {} }, false), null);
});

test("bookingErrorView explains each upstream code in Arabic", () => {
  assert.deepEqual(bookingErrorView("SALES_CLOSED", null, 2), { message: "البيع مغلق حاليًا أو لم يبدأ بعد.", suggestQuantity: null });
  assert.equal(bookingErrorView("MATCH_NOT_SELLABLE", null, 2).message, "المباراة غير متاحة للبيع.");
  assert.equal(bookingErrorView("not_found", null, 2).message, "المباراة غير متاحة للبيع.");
  assert.equal(bookingErrorView("BOOKING_LIMIT_EXCEEDED", null, 2).message, "وصلت للحد الأقصى: 10 تذاكر لكل مباراة.");
  assert.equal(bookingErrorView("SEAT_CONFLICT", null, 2).message, "حُجزت المقاعد قبلك، حاول مرة أخرى.");
  assert.equal(bookingErrorView("rate_limited", null, 2).message, "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.");
  assert.equal(bookingErrorView("RATE_LIMIT_EXCEEDED", null, 2).message, "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.");
  assert.equal(bookingErrorView("unauthenticated", null, 2).message, "سجّل الدخول للمتابعة.");
  assert.equal(bookingErrorView(undefined, null, 2).message, "تعذّر إتمام الحجز الآن. حاول بعد قليل.");
});

test("NO_CONTIGUOUS_BLOCK offers the largest available block", () => {
  assert.deepEqual(bookingErrorView("NO_CONTIGUOUS_BLOCK", 3, 5), { message: "لا توجد 5 مقاعد متجاورة. أكبر عدد متاح الآن 3.", suggestQuantity: 3 });
  assert.deepEqual(bookingErrorView("NO_CONTIGUOUS_BLOCK", 0, 5), { message: "لا توجد مقاعد متاحة في هذا القسم الآن.", suggestQuantity: null });
  assert.deepEqual(bookingErrorView("NO_CONTIGUOUS_BLOCK", null, 5), { message: "لا توجد مقاعد متاحة في هذا القسم الآن.", suggestQuantity: null });
});

test("createWindowLimiter allows `limit` hits per window per key", () => {
  let now = 1_000;
  const limiter = createWindowLimiter(2, 60_000, () => now);
  assert.equal(limiter.hit("a"), false);
  assert.equal(limiter.hit("a"), false);
  assert.equal(limiter.hit("a"), true);
  assert.equal(limiter.hit("b"), false);
  now += 60_000;
  assert.equal(limiter.hit("a"), false);
});
