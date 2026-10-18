import test from "node:test";
import assert from "node:assert/strict";
import { availableFrom } from "../app/api/event-bookings/shared";
import { UpstreamError } from "../lib/upstream";

test("availableFrom reads available_slots from the web-api error envelope", () => {
  const error = new UpstreamError(422, "INSUFFICIENT_SLOTS", "x", { error: { code: "INSUFFICIENT_SLOTS", details: { available_slots: 2 } } });
  assert.equal(availableFrom(error), 2);
  assert.equal(availableFrom(new UpstreamError(422, "EVENT_FULLY_BOOKED")), null);
});
