import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const TICKET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Maps an upstream failure status for ticket endpoints. Someone else's ticket (403) looks like a missing one. */
export function ticketFailure(status: number): NextResponse {
  if (status === 401) {
    const response = fail(401, "unauthenticated");
    clearSessionCookie(response);
    return response;
  }
  if (status === 403 || status === 404) return fail(404, "not_found");
  if (status === 429) return fail(429, "rate_limited");
  return fail(503, "upstream_unavailable");
}

export function streamFile(upstreamResponse: Response, fallbackType: string, filename: string): Response {
  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") || fallbackType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Relative Location: correct behind any proxy, whatever Host the app sees. */
export function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
}
