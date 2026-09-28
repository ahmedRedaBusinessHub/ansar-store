import test from "node:test";
import assert from "node:assert/strict";
import { isTamaraCheckoutUrl } from "../lib/tamara";

test("isTamaraCheckoutUrl returns true for valid Tamara checkout URLs", () => {
  assert.equal(isTamaraCheckoutUrl("https://checkout.tamara.co/x"), true);
  assert.equal(isTamaraCheckoutUrl("https://checkout-sandbox.tamara.co/checkout/abc?locale=ar"), true);
});

test("isTamaraCheckoutUrl returns false for invalid, insecure, or untrusted URLs", () => {
  assert.equal(isTamaraCheckoutUrl("http://checkout.tamara.co/x"), false);
  assert.equal(isTamaraCheckoutUrl("https://tamara.co.evil.com/x"), false);
  assert.equal(isTamaraCheckoutUrl("https://eviltamara.co/x"), false);
  assert.equal(isTamaraCheckoutUrl("https://user:pw@checkout.tamara.co/"), false);
  assert.equal(isTamaraCheckoutUrl("javascript:alert(1)"), false);
  assert.equal(isTamaraCheckoutUrl(""), false);
  assert.equal(isTamaraCheckoutUrl(42), false);
  assert.equal(isTamaraCheckoutUrl(null), false);
});
