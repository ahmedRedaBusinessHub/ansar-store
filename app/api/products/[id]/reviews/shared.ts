import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";

export function reviewFail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

const COMMENT_CODES = new Set(["COMMENT_TOO_SHORT", "COMMENT_TOO_LONG", "COMMENT_INVALID_CHARS"]);

/** Maps a web-api failure on the review endpoints to a storefront error code. web-api messages are never forwarded. */
export function reviewUpstreamFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) {
      const response = reviewFail(401, "unauthenticated");
      clearSessionCookie(response);
      return response;
    }
    if (error.status === 403) return reviewFail(403, error.code === "NOT_VERIFIED_BUYER" ? "not_verified_buyer" : "forbidden");
    if (error.status === 404) return reviewFail(404, "not_found");
    if (error.status === 409) return reviewFail(409, "review_hidden");
    if (error.status === 429) return reviewFail(429, "rate_limited");
    if (error.status === 422 && COMMENT_CODES.has(error.code)) return reviewFail(422, error.code.toLowerCase());
    if (error.status === 400 || error.status === 422) return reviewFail(422, "invalid_input");
  }
  return reviewFail(503, "upstream_unavailable");
}
