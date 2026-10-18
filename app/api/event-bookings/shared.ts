import { NextResponse } from "next/server";
import { createWindowLimiter } from "@/lib/rate-window";
import { clearSessionCookie } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";

/** Per-IP event booking attempts in this process (web-api also limits per user). */
export const eventBookingIpLimiter = createWindowLimiter(20, 10 * 60 * 1000);

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

/** `available_slots` from a web-api `{ error: { details } }` envelope, when present. */
export function availableFrom(error: UpstreamError): number | null {
  const envelope = error.details.error;
  const details = envelope && typeof envelope === "object" ? (envelope as { details?: unknown }).details : null;
  const value = details && typeof details === "object" ? (details as { available_slots?: unknown }).available_slots : null;
  return typeof value === "number" ? value : null;
}

/** Browser contract: { error, code?, available? }. 409 keeps its status; other 4xx become 422. */
export function eventFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) {
      const response = fail(401, "unauthenticated");
      clearSessionCookie(response);
      return response;
    }
    if (error.status === 429) return fail(429, "rate_limited", { code: "RATE_LIMIT_EXCEEDED" });
    if (error.status === 404 || error.status === 403) return fail(404, "not_found", { code: error.code });
    if (error.status >= 400 && error.status < 500) {
      const available = availableFrom(error);
      return fail(error.status === 409 ? 409 : 422, "booking_rejected", {
        code: error.code,
        ...(available !== null ? { available } : {}),
      });
    }
  }
  return fail(503, "upstream_unavailable");
}
