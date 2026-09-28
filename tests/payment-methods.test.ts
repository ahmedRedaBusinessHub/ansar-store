import test from "node:test";
import assert from "node:assert/strict";
import { moyasarMethodConfig, readMethodFlags } from "../lib/payment-methods";

test("readMethodFlags defaults STC Pay on and Apple Pay off when unset", () => {
  assert.deepEqual(readMethodFlags({}), { stcPay: true, applePay: false });
});

test("readMethodFlags parses flags with 0/1 and false/TRUE variants", () => {
  assert.deepEqual(readMethodFlags({ stcPay: "0", applePay: "1" }), { stcPay: false, applePay: true });
  assert.deepEqual(readMethodFlags({ stcPay: "false", applePay: "TRUE" }), { stcPay: false, applePay: true });
  assert.deepEqual(readMethodFlags({ stcPay: "FALSE", applePay: "true" }), { stcPay: false, applePay: true });
});

test("moyasarMethodConfig enables STC Pay without Apple Pay", () => {
  const config = moyasarMethodConfig({ stcPay: true, applePay: false }, "x");
  assert.deepEqual(config.methods, ["creditcard", "stcpay"]);
  assert.ok(config.supported_networks.includes("amex"));
  assert.equal(config.apple_pay, undefined);
});

test("moyasarMethodConfig falls back to default label when whitespace-only and configures Apple Pay", () => {
  const config = moyasarMethodConfig({ stcPay: true, applePay: true }, "  ");
  assert.deepEqual(config.methods, ["creditcard", "stcpay", "applepay"]);
  assert.equal(config.apple_pay?.label, "نادي الأنصار");
  assert.equal(config.apple_pay?.validate_merchant_url, "https://api.moyasar.com/v1/applepay/initiate");
  assert.equal(config.apple_pay?.country, "SA");
  assert.deepEqual(config.apple_pay?.supported_countries, ["SA"]);
});

test("moyasarMethodConfig returns only creditcard when both flags are disabled", () => {
  assert.deepEqual(moyasarMethodConfig({ stcPay: false, applePay: false }, "x").methods, ["creditcard"]);
});
