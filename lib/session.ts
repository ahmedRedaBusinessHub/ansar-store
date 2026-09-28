import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "ansar_session";

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 82_800 };
}

export function getSessionToken(request: NextRequest): string | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  return value && value.length < 4096 ? value : null;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

/** CSRF guard: cross-site HTML forms cannot send application/json without a CORS preflight. */
export function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
