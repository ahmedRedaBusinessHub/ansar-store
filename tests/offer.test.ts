import test from "node:test";
import assert from "node:assert/strict";
import { offerFor } from "../lib/offer";

test("offerFor returns null when the product has no original price", () => {
  assert.equal(offerFor({ price: 100 }, 100), null);
});

test("offerFor returns the original and floored percent for the base price", () => {
  assert.deepEqual(offerFor({ price: 450, originalPrice: 600 }, 450), { original: 600, percentOff: 25 });
  // 155/600 = 25.83% -> 25, never 26
  assert.deepEqual(offerFor({ price: 445, originalPrice: 600 }, 445), { original: 600, percentOff: 25 });
});

test("offerFor does not lose a percent to floating-point error", () => {
  assert.deepEqual(offerFor({ price: 80, originalPrice: 100 }, 80), { original: 100, percentOff: 20 });
  assert.deepEqual(offerFor({ price: 90, originalPrice: 100 }, 90), { original: 100, percentOff: 10 });
});

test("offerFor shifts the original by the selected option extras", () => {
  // base 200, original 250, a +35.5 option is chosen -> shown 235.5, struck 285.5
  assert.deepEqual(offerFor({ price: 200, originalPrice: 250 }, 235.5), { original: 285.5, percentOff: 17 });
});

test("offerFor hides inverted, equal and sub-1% pairs", () => {
  assert.equal(offerFor({ price: 300, originalPrice: 300 }, 300), null);
  assert.equal(offerFor({ price: 350, originalPrice: 300 }, 350), null);
  assert.equal(offerFor({ price: 598, originalPrice: 600 }, 598), null);
});

test("offerFor hides broken shown prices", () => {
  assert.equal(offerFor({ price: 100, originalPrice: 150 }, Number.NaN), null);
  assert.equal(offerFor({ price: 100, originalPrice: 150 }, -1), null);
});
