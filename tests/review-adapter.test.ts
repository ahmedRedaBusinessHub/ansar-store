import test from "node:test";
import assert from "node:assert/strict";
import { toMyReview, toReview, toReviewPage, toReviewSummary } from "../lib/review-adapter";

const row = {
  id: "r1", rating: 4, comment: "جودة ممتازة", reviewer_name: "أحمد م.",
  created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-02T10:00:00.000Z", is_mine: false,
};
const mapped = {
  id: "r1", rating: 4, comment: "جودة ممتازة", reviewerName: "أحمد م.",
  createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z", isMine: false,
};
const mine = { id: "m1", rating: 2, comment: null, status: "HIDDEN", created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-01T10:00:00.000Z" };

test("toReview maps web-api snake_case to the storefront Review", () => {
  assert.deepEqual(toReview(row), mapped);
  assert.deepEqual(toReview({ ...row, is_mine: true }), { ...mapped, isMine: true });
});

test("toReview: null comment/name stay null; missing is_mine → false", () => {
  const { is_mine: _ignored, ...withoutMine } = row;
  assert.deepEqual(toReview({ ...withoutMine, comment: null, reviewer_name: null }), { ...mapped, comment: null, reviewerName: null, isMine: false });
});

test("toReview rejects bad ratings and malformed rows", () => {
  for (const rating of [0, 6, 4.5, "4"]) assert.equal(toReview({ ...row, rating }), null);
  assert.equal(toReview({ id: "x" }), null);
  assert.equal(toReview(null), null);
});

test("toMyReview keeps the moderation status and rejects unknown statuses", () => {
  assert.deepEqual(toMyReview(mine), { id: "m1", rating: 2, comment: null, status: "HIDDEN", createdAt: mine.created_at, updatedAt: mine.updated_at });
  assert.equal(toMyReview({ ...mine, status: "DELETED" }), null);
});

test("toReviewSummary maps counts, eligibility and the caller's review", () => {
  assert.deepEqual(toReviewSummary({ avg_rating: 4.3, reviews_count: 3, can_review: true, my_review: null }),
    { average: 4.3, count: 3, canReview: true, myReview: null });
});

test("toReviewSummary: a hidden own review is returned; zero count forces average null", () => {
  assert.deepEqual(toReviewSummary({ avg_rating: 2, reviews_count: 0, can_review: false, my_review: mine }), {
    average: null, count: 0, canReview: false,
    myReview: { id: "m1", rating: 2, comment: null, status: "HIDDEN", createdAt: mine.created_at, updatedAt: mine.updated_at },
  });
});

test("toReviewSummary returns null for malformed data", () => {
  assert.equal(toReviewSummary(null), null);
  assert.equal(toReviewSummary({}), null);
  assert.equal(toReviewSummary({ avg_rating: 4, reviews_count: 1, can_review: true, my_review: { id: "bad" } }), null);
});

test("toReviewPage drops broken rows and reads pagination meta", () => {
  assert.deepEqual(toReviewPage([row, { id: "broken" }], { page: 2, totalCount: 7, pagesCount: 2 }), { reviews: [mapped], page: 2, pages: 2, total: 7 });
  assert.deepEqual(toReviewPage("not-an-array", null), { reviews: [], page: 1, pages: 1, total: 0 });
});
