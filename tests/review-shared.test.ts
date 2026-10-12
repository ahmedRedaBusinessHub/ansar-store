import test from "node:test";
import assert from "node:assert/strict";
import { UpstreamError } from "../lib/upstream";
import { reviewFail, reviewUpstreamFailure } from "../app/api/products/[id]/reviews/shared";

async function mapped(error: unknown) {
  const response = reviewUpstreamFailure(error);
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
}

test("reviewFail returns { error } with the given status", async () => {
  const response = reviewFail(400, "invalid_input");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("401 → unauthenticated and the session cookie is cleared", async () => {
  const result = await mapped(new UpstreamError(401, "UNAUTHORIZED"));
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "unauthenticated" });
  assert.match(result.cookie ?? "", /ansar_session=;.*Max-Age=0/i);
});

test("maps web-api review errors to storefront codes", async () => {
  const cases: [UpstreamError, number, string][] = [
    [new UpstreamError(403, "NOT_VERIFIED_BUYER"), 403, "not_verified_buyer"],
    [new UpstreamError(403, "ACCOUNT_DEACTIVATED"), 403, "forbidden"],
    [new UpstreamError(404, "PRODUCT_NOT_FOUND"), 404, "not_found"],
    [new UpstreamError(404, "REVIEW_NOT_FOUND"), 404, "not_found"],
    [new UpstreamError(409, "REVIEW_HIDDEN"), 409, "review_hidden"],
    [new UpstreamError(429, "RATE_LIMIT_EXCEEDED"), 429, "rate_limited"],
    [new UpstreamError(422, "COMMENT_TOO_SHORT"), 422, "comment_too_short"],
    [new UpstreamError(422, "COMMENT_TOO_LONG"), 422, "comment_too_long"],
    [new UpstreamError(422, "COMMENT_INVALID_CHARS"), 422, "comment_invalid_chars"],
    [new UpstreamError(422, "VALIDATION_ERROR"), 422, "invalid_input"],
    [new UpstreamError(400, "BAD_REQUEST"), 422, "invalid_input"],
    [new UpstreamError(500, "HTTP_500"), 503, "upstream_unavailable"],
    [new UpstreamError(503, "UPSTREAM_UNAVAILABLE"), 503, "upstream_unavailable"],
  ];
  for (const [error, status, code] of cases) {
    const result = await mapped(error);
    assert.equal(result.status, status, error.code);
    assert.deepEqual(result.body, { error: code }, error.code);
    assert.equal(result.cookie, null, error.code);
  }
});

test("non-UpstreamError failures → 503 upstream_unavailable", async () => {
  const result = await mapped(new Error("boom"));
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "upstream_unavailable" });
});
