import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";

export function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Seat-map reads: 401 clears the session; a missing tier or section (403/404, or an OPEN tier) is 404; anything else 503. */
export function readFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) {
      const response = fail(401, "unauthenticated");
      clearSessionCookie(response);
      return response;
    }
    if (error.status === 403 || error.status === 404) return fail(404, "not_found");
    if (error.status === 429) return fail(429, "rate_limited");
  }
  return fail(503, "upstream_unavailable");
}
