import test from "node:test";
import assert from "node:assert/strict";
import { tamaraReturnAction } from "../lib/tamara-return";

const PAY = "77777777-7777-4777-8777-777777777777";
const SUB = "66666666-6666-4666-8666-666666666666";

test("EVENT success goes to the ticket result page", () => {
  assert.deepEqual(tamaraReturnAction("success", PAY, SUB, { entityType: "EVENT", entityId: SUB }),
    { kind: "redirect", to: `/checkout/tickets/result?payment=${PAY}&event=${SUB}` });
});

test("EVENT failure offers a retry on the ticket pay page", () => {
  assert.deepEqual(tamaraReturnAction("failure", PAY, SUB, { entityType: "EVENT", entityId: SUB }),
    { kind: "retry", outcome: "failure", retryHref: `/checkout/tickets/pay?event=${SUB}`, backHref: "/tickets", backLabel: "تذاكري" });
});
