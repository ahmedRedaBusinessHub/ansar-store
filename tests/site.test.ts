import test from "node:test";
import assert from "node:assert/strict";
import { readSite } from "../lib/site";

test("readSite returns validated content without products", async () => {
  const site = await readSite();
  assert.equal(typeof site.name, "string");
  assert.equal(typeof site.season, "string");
  assert.match(site.hero.image, /^\/images\//);
  assert.deepEqual(site.shipping, { fee: 0, freeAbove: 0 });
  assert.deepEqual(site.policies.map((p) => p.id), ["checkout", "shipping", "returns"]);
  assert.equal("products" in site, false);
});
