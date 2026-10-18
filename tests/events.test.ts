import test from "node:test";
import assert from "node:assert/strict";
import {
  isPastEvent, maxEventQuantity, toEventBookingInfo, toEventSummary, toMyEventBooking, eventPriceLabel,
} from "../lib/events";
import { cancellationReasonLabel, eventAddPayHref, eventBookingErrorView, eventPayHref, notBookableLabel } from "../lib/event-booking";

const ID = "44444444-4444-4444-8444-444444444444";
const ROW = {
  id: ID, title_ar: "أمسية", description_ar: "وصف", image_url: "/uploads/e.jpg", date: "2026-11-01T18:00:00.000Z",
  price: "50.00", external_booking_url: null,
  availability: { total_capacity: 10, confirmed_count: 7, available_slots: 3, is_fully_booked: false },
};

test("toEventSummary parses the web-api row", () => {
  const e = toEventSummary(ROW)!;
  assert.equal(e.price, 50);
  assert.deepEqual(e.availability, { total: 10, available: 3, full: false });
  assert.match(e.image ?? "", /\/uploads\/e\.jpg$/);
});

test("toEventSummary: unlimited events have null availability; bad rows are null", () => {
  assert.equal(toEventSummary({ ...ROW, availability: null })!.availability, null);
  assert.equal(toEventSummary({ ...ROW, price: "-1" }), null);
  assert.equal(toEventSummary({ id: ID }), null);
});

test("toEventBookingInfo maps reason and my booking", () => {
  const info = toEventBookingInfo({
    event: ROW, availability: ROW.availability,
    my_booking: { id: ID, status: "CANCELLED", quantity: 1, hold_expires_at: null },
    bookable: false, not_bookable_reason: "BOOKED", max_per_booking: 10,
  })!;
  assert.equal(info.reason, "BOOKED");
  assert.equal(info.myBooking?.status, "CANCELLED");
});

test("maxEventQuantity is min(available, maxPerBooking), and maxPerBooking when unlimited", () => {
  const base = toEventBookingInfo({ event: ROW, availability: ROW.availability, my_booking: null, bookable: true, not_bookable_reason: null, max_per_booking: 10 })!;
  assert.equal(maxEventQuantity(base), 3);
  assert.equal(maxEventQuantity({ ...base, event: { ...base.event, availability: null } }), 10);
});

test("toMyEventBooking keeps tickets and drops unknown statuses", () => {
  const b = toMyEventBooking({
    id: ID, status: "CONFIRMED", quantity: 1, hold_expires_at: null,
    event: { id: ID, title_ar: "أمسية", image_url: null, date: ROW.date, price: "0" },
    tickets: [{ id: "t1", ticket_number: 1, status: "UNUSED", qr_payload: "abc" }],
  })!;
  assert.deepEqual(b.tickets, [{ id: "t1", number: 1, status: "UNUSED", qrPayload: "abc" }]);
  assert.equal(toMyEventBooking({ ...b, status: "WEIRD" }), null);
});

test("price label and past check", () => {
  assert.equal(eventPriceLabel(0), "مجاني");
  assert.ok(eventPriceLabel(50).includes("50"));
  assert.equal(isPastEvent("2026-01-01T00:00:00Z", Date.parse("2026-06-01T00:00:00Z")), true);
});

test("error views", () => {
  assert.equal(eventBookingErrorView("INSUFFICIENT_SLOTS", 2, null).clampTo, 2);
  assert.ok(eventBookingErrorView("INSUFFICIENT_SLOTS", 2, null).message.includes("2"));
  assert.equal(eventBookingErrorView("ALREADY_SUBSCRIBED", null, null).showTicketsLink, true);
  assert.equal(eventBookingErrorView("EXTERNAL_BOOKING_ONLY", null, "https://x.example").externalUrl, "https://x.example");
  assert.ok(eventBookingErrorView("EVENT_PAST", null, null).message.includes("انتهت"));
  assert.ok(eventBookingErrorView("SOMETHING_NEW", null, null).message.length > 0);
});

test("not-bookable copy distinguishes a cancelled booking", () => {
  assert.notEqual(notBookableLabel("BOOKED", "CANCELLED"), notBookableLabel("BOOKED", "CONFIRMED"));
  assert.ok(notBookableLabel("FULL", null).length > 0);
});

test("pay hrefs", () => {
  assert.equal(eventPayHref(ID, ID, null), `/checkout/tickets/pay?event=${ID}&e=${ID}`);
  assert.ok(eventPayHref(ID, ID, "2026-11-01T18:00:00.000Z").includes("expires="));
  assert.equal(eventAddPayHref(ID, "55555555-5555-4555-8555-555555555555", ID), `/checkout/tickets/pay?event=${ID}&add=55555555-5555-4555-8555-555555555555&e=${ID}`);
});

test("cancellation reasons are translated", () => {
  assert.ok(cancellationReasonLabel("Event starts in less than 24 hours").includes("24"));
  assert.ok(cancellationReasonLabel(null).length > 0);
});
