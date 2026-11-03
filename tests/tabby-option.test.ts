import test from "node:test";
import assert from "node:assert/strict";
import { entityIdKey, tabbyInstalmentLabel } from "../lib/tabby";

test("entityIdKey maps each of the four entity types", () => {
  assert.equal(entityIdKey({ type: "ORDER", id: "00000000-0000-0000-0000-000000000001" }), "orderId");
  assert.equal(entityIdKey({ type: "SEASON_PASS", id: "00000000-0000-0000-0000-000000000002" }), "passId");
  assert.equal(entityIdKey({ type: "EVENT", id: "00000000-0000-0000-0000-000000000003" }), "subscriptionId");
  assert.equal(entityIdKey({ type: "MATCH_BOOKING", id: "00000000-0000-0000-0000-000000000004" }), "bookingId");
});

test("tabbyInstalmentLabel(10150) formats correctly with Intl", () => {
  const halalah = 10150;
  const expected = "4 دفعات بقيمة " + new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(10150 / 100) + " ر.س شهريًا أو حتى 12 شهرًا. اعرف المزيد";
  assert.equal(tabbyInstalmentLabel(halalah), expected);
});
