import { NextResponse } from "next/server";
import { createWindowLimiter } from "@/lib/rate-window";
import { isUuid } from "@/lib/season-pass";
import { clearSessionCookie } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";

/** Per-IP purchase attempts in this process (web-api also limits per user: 6 / 10 min). */
export const passIpLimiter = createWindowLimiter(20, 10 * 60 * 1000);

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function readBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

function unauthenticated(): NextResponse {
  const response = fail(401, "unauthenticated");
  clearSessionCookie(response);
  return response;
}

/** `error.details.taken_seat_ids` from the web-api envelope kept on UpstreamError.details. */
function takenSeatIds(body: Record<string, unknown>): string[] {
  const error = body.error;
  const details = error && typeof error === "object" ? (error as Record<string, unknown>).details : null;
  const ids = details && typeof details === "object" ? (details as Record<string, unknown>).taken_seat_ids : null;
  return Array.isArray(ids) ? ids.filter(isUuid) : [];
}

/** Browser contract for buy failures: { error, code?, takenSeatIds? }. 409 keeps its status; other 4xx become 422. */
export function passFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 401) return unauthenticated();
    if (error.status === 429) return fail(429, "rate_limited", { code: error.code });
    if (error.status === 404) return fail(404, "not_found", { code: error.code });
    if (error.status >= 400 && error.status < 500) {
      return fail(error.status === 409 ? 409 : 422, "pass_rejected", {
        code: error.code,
        ...(error.code === "SEASON_SEAT_CONFLICT" ? { takenSeatIds: takenSeatIds(error.details) } : {}),
      });
    }
  }
  return fail(503, "upstream_unavailable");
}

/** Reads of the shopper's passes: 401 clears the session, anything else is 503. */
export function listFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError && error.status === 401) return unauthenticated();
  return fail(503, "upstream_unavailable");
}
