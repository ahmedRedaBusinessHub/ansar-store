import test from "node:test";
import assert from "node:assert/strict";
import { isTabbyCheckoutUrl, tabbyRejectionMessage } from "../lib/tabby";
import { instalmentEntity } from "../lib/tamara";

const ORDER = "44444444-4444-4444-8444-444444444444";
const BOOKING = "33333333-3333-4333-8333-333333333333";

test("isTabbyCheckoutUrl accepts valid Tabby checkout URLs", () => {
  assert.equal(isTabbyCheckoutUrl("https://checkout.tabby.sa/x"), true);
  assert.equal(isTabbyCheckoutUrl("https://checkout.tabby.ai/x"), true);
  assert.equal(isTabbyCheckoutUrl("https://checkout.sandbox.tabby.ai/x"), true);
  assert.equal(isTabbyCheckoutUrl("https://tabby.ai"), true);
  assert.equal(isTabbyCheckoutUrl("https://tabby.sa"), true);
});

test("isTabbyCheckoutUrl rejects invalid, insecure, or untrusted URLs", () => {
  assert.equal(isTabbyCheckoutUrl("http://checkout.tabby.sa"), false);
  assert.equal(isTabbyCheckoutUrl("https://tabby.sa.evil.com"), false);
  assert.equal(isTabbyCheckoutUrl("https://eviltabby.ai"), false);
  assert.equal(isTabbyCheckoutUrl("https://user:pass@checkout.tabby.sa"), false);
  assert.equal(isTabbyCheckoutUrl("javascript:alert(1)"), false);
  assert.equal(isTabbyCheckoutUrl(""), false);
  assert.equal(isTabbyCheckoutUrl(null), false);
  assert.equal(isTabbyCheckoutUrl(undefined), false);
});

test("tabbyRejectionMessage maps reasons to Arabic copy and falls back to not_available", () => {
  assert.equal(
    tabbyRejectionMessage("order_amount_too_low"),
    "قيمة الطلب أقل من الحد الأدنى المطلوب لاستخدام خدمة تابي. يُرجى زيادة قيمة الطلب أو استخدام وسيلة دفع أخرى.",
  );
  assert.equal(
    tabbyRejectionMessage("order_amount_too_high"),
    "قيمة الطلب تفوق الحد الأقصى المسموح به حاليًا مع تابي. يُرجى تخفيض قيمة السلة أو استخدام وسيلة دفع أخرى.",
  );
  assert.equal(
    tabbyRejectionMessage("not_available"),
    "نأسف، تابي غير قادر على الموافقة على هذه العملية. الرجاء استخدام طريقة دفع أخرى.",
  );
  assert.equal(
    tabbyRejectionMessage("weird"),
    "نأسف، تابي غير قادر على الموافقة على هذه العملية. الرجاء استخدام طريقة دفع أخرى.",
  );
  assert.equal(
    tabbyRejectionMessage(null),
    "نأسف، تابي غير قادر على الموافقة على هذه العملية. الرجاء استخدام طريقة دفع أخرى.",
  );
  assert.equal(
    tabbyRejectionMessage(undefined),
    "نأسف، تابي غير قادر على الموافقة على هذه العملية. الرجاء استخدام طريقة دفع أخرى.",
  );
});

test("instalmentEntity supports bookingId as MATCH_BOOKING and enforces single candidate", () => {
  assert.deepEqual(instalmentEntity({ bookingId: BOOKING }), { type: "MATCH_BOOKING", id: BOOKING });
  assert.equal(instalmentEntity({ bookingId: BOOKING, orderId: ORDER }), null);
  assert.equal(instalmentEntity({ bookingId: "not-a-uuid" }), null);
});
