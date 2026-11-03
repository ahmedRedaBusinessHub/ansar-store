import test from "node:test";
import assert from "node:assert/strict";
import { instalmentReturnAction, tamaraReturnAction } from "../lib/tamara-return";

const P = "55555555-5555-4555-8555-555555555555";
const E = "66666666-6666-4666-8666-666666666666";

test("MATCH_BOOKING success → /checkout/tickets/result?payment=<p>&booking=<id>", () => {
  const booking = { entityType: "MATCH_BOOKING", entityId: E };
  assert.deepEqual(instalmentReturnAction("success", P, E, booking), {
    kind: "redirect",
    to: `/checkout/tickets/result?payment=${P}&booking=${E}`,
  });
});

test("MATCH_BOOKING failure/cancel → retry /checkout/tickets/pay?booking=<id>, back /tickets 'تذاكري'", () => {
  const booking = { entityType: "MATCH_BOOKING", entityId: E };
  assert.deepEqual(instalmentReturnAction("failure", P, E, booking), {
    kind: "retry",
    outcome: "failure",
    retryHref: `/checkout/tickets/pay?booking=${E}`,
    backHref: "/tickets",
    backLabel: "تذاكري",
  });
  assert.deepEqual(instalmentReturnAction("cancel", P, E, booking), {
    kind: "retry",
    outcome: "cancel",
    retryHref: `/checkout/tickets/pay?booking=${E}`,
    backHref: "/tickets",
    backLabel: "تذاكري",
  });
});

test("instalmentReturnAction is the same function", () => {
  assert.equal(instalmentReturnAction, tamaraReturnAction);
});
