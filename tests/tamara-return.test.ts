import test from "node:test";
import assert from "node:assert/strict";
import { tamaraReturnAction } from "../lib/tamara-return";

const P = "55555555-5555-4555-8555-555555555555";
const E = "66666666-6666-4666-8666-666666666666";

test("store order: success → order result page; failure/cancel → order pay page", () => {
  const order = { entityType: "ORDER", entityId: E };
  assert.deepEqual(tamaraReturnAction("success", P, E, order), { kind: "redirect", to: `/checkout/result?payment=${P}&order=${E}` });
  assert.deepEqual(tamaraReturnAction("cancel", P, E, order), {
    kind: "retry", outcome: "cancel", retryHref: `/checkout/pay?order=${E}`, backHref: "/orders", backLabel: "طلباتي",
  });
});

test("season pass: success → ticket result page; failure → ticket pay page", () => {
  const pass = { entityType: "SEASON_PASS", entityId: E };
  assert.deepEqual(tamaraReturnAction("success", P, E, pass), { kind: "redirect", to: `/checkout/tickets/result?payment=${P}&pass=${E}` });
  assert.deepEqual(tamaraReturnAction("failure", P, E, pass), {
    kind: "retry", outcome: "failure", retryHref: `/checkout/tickets/pay?pass=${E}`, backHref: "/tickets", backLabel: "تذاكري",
  });
});

test("no lookup, a mismatched entity id, or another type → neutral", () => {
  assert.deepEqual(tamaraReturnAction("success", P, E, null), { kind: "neutral" });
  assert.deepEqual(tamaraReturnAction("success", P, E, { entityType: "SEASON_PASS", entityId: P }), { kind: "neutral" });
  assert.deepEqual(tamaraReturnAction("success", P, E, { entityType: "MATCH_BOOKING", entityId: E }), { kind: "neutral" });
});
