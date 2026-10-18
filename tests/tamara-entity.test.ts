import test from "node:test";
import assert from "node:assert/strict";
import { instalmentEntity } from "../lib/tamara";

const ID = "44444444-4444-4444-8444-444444444444";

test("instalmentEntity: exactly one of orderId / passId, a UUID", () => {
  assert.deepEqual(instalmentEntity({ orderId: ID }), { type: "ORDER", id: ID });
  assert.deepEqual(instalmentEntity({ passId: ID }), { type: "SEASON_PASS", id: ID });
  assert.equal(instalmentEntity({ orderId: ID, passId: ID }), null);
  assert.equal(instalmentEntity({}), null);
  assert.equal(instalmentEntity({ orderId: "nope" }), null);
  assert.equal(instalmentEntity({ passId: 42 }), null);
});

test("instalmentEntity: subscriptionId → EVENT; still exactly one id", () => {
  assert.deepEqual(instalmentEntity({ subscriptionId: ID }), { type: "EVENT", id: ID });
  assert.equal(instalmentEntity({ subscriptionId: ID, passId: ID }), null);
});

