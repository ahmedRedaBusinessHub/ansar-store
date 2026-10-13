import { NextResponse } from "next/server";
import { createWindowLimiter } from "@/lib/rate-window";
import { clearSessionCookie } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";

/** Per-IP booking attempts in this process (web-api also limits per user). */
export const bookingIpLimiter = createWindowLimiter(20, 10 * 60 * 1000);

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function readBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

/** Browser contract: { error, code?, largestAvailable? }. 403/409 keep their status; other 4xx become 422. */
export function bookingFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) {
      const response = fail(401, "unauthenticated");
      clearSessionCookie(response);
      return response;
    }
    if (error.status === 429) return fail(429, "rate_limited", { code: error.code });
    if (error.status === 404) return fail(404, "not_found", { code: error.code });
    if (error.status >= 400 && error.status < 500) {
      const largest = error.details.largest_available;
      return fail(error.status === 403 || error.status === 409 ? error.status : 422, "booking_rejected", {
        code: error.code,
        ...(typeof largest === "number" ? { largestAvailable: largest } : {}),
      });
    }
  }
  return fail(503, "upstream_unavailable");
}
