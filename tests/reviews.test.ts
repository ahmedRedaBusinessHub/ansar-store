import test from "node:test";
import assert from "node:assert/strict";
import { checkComment, formatAverage, formatReviewDate, REVIEW_COMMENT_MAX, REVIEW_SORTS, REVIEWS_PER_PAGE, reviewCountLabel, reviewErrorMessage, reviewerLabel } from "../lib/reviews";

test("constants match the web-api contract", () => {
  assert.deepEqual([...REVIEW_SORTS], ["recent", "highest", "lowest"]);
  assert.equal(REVIEWS_PER_PAGE, 5);
  assert.equal(REVIEW_COMMENT_MAX, 1000);
});

test("checkComment: empty or whitespace-only → null comment", () => {
  assert.deepEqual(checkComment(null), { ok: true, comment: null });
  assert.deepEqual(checkComment(undefined), { ok: true, comment: null });
  assert.deepEqual(checkComment("   \n  "), { ok: true, comment: null });
});

test("checkComment normalizes line breaks and trims like web-api", () => {
  assert.deepEqual(checkComment("  قماش ممتاز\r\n\r\n\r\nومقاس مضبوط  "), { ok: true, comment: "قماش ممتاز\n\nومقاس مضبوط" });
});

test("checkComment counts code points (emoji = 1) and enforces 5..1000", () => {
  assert.deepEqual(checkComment("جيد"), { ok: false, error: "comment_too_short" });
  assert.deepEqual(checkComment("👍👍👍👍👍"), { ok: true, comment: "👍👍👍👍👍" });
  assert.deepEqual(checkComment("ا".repeat(REVIEW_COMMENT_MAX)), { ok: true, comment: "ا".repeat(REVIEW_COMMENT_MAX) });
  assert.deepEqual(checkComment("ا".repeat(REVIEW_COMMENT_MAX + 1)), { ok: false, error: "comment_too_long" });
});

test("checkComment rejects control characters except newline", () => {
  assert.deepEqual(checkComment("تعليق\u0007جيد جدا"), { ok: false, error: "comment_invalid_chars" });
  assert.deepEqual(checkComment("تعليق\tجيد جدا"), { ok: false, error: "comment_invalid_chars" });
  assert.deepEqual(checkComment("سطر أول\nسطر ثانٍ"), { ok: true, comment: "سطر أول\nسطر ثانٍ" });
});

test("reviewErrorMessage maps known codes and falls back for unknown ones", () => {
  assert.equal(reviewErrorMessage("not_verified_buyer"), "التقييم متاح لمن اشترى المنتج واستلم طلبه.");
  assert.equal(reviewErrorMessage("whatever"), "الخدمة غير متاحة الآن. حاول بعد قليل.");
  assert.equal(reviewErrorMessage("constructor"), "الخدمة غير متاحة الآن. حاول بعد قليل.");
  assert.equal(reviewErrorMessage(undefined), "الخدمة غير متاحة الآن. حاول بعد قليل.");
});

test("reviewerLabel falls back for deleted accounts", () => {
  assert.equal(reviewerLabel("أحمد م."), "أحمد م.");
  assert.equal(reviewerLabel(null), "عضو سابق");
  assert.equal(reviewerLabel("   "), "عضو سابق");
});

test("formatAverage shows one decimal with Latin digits", () => {
  assert.equal(formatAverage(4), "4.0");
  assert.equal(formatAverage(4.5), "4.5");
});

test("reviewCountLabel uses Arabic plural forms", () => {
  assert.equal(reviewCountLabel(0), "لا توجد تقييمات");
  assert.equal(reviewCountLabel(1), "تقييم واحد");
  assert.equal(reviewCountLabel(2), "تقييمان");
  assert.equal(reviewCountLabel(3), "3 تقييمات");
  assert.equal(reviewCountLabel(10), "10 تقييمات");
  assert.equal(reviewCountLabel(11), "11 تقييمًا");
  assert.equal(reviewCountLabel(100), "100 تقييم");
});

test("formatReviewDate: empty for invalid input, Gregorian Arabic date otherwise", () => {
  assert.equal(formatReviewDate("nope"), "");
  assert.match(formatReviewDate("2026-10-01T10:00:00.000Z"), /٢٠٢٦/);
});
