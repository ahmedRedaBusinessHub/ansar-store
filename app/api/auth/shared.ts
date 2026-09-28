import { NextResponse } from "next/server";
import { z } from "zod";
import { upstream, UpstreamError } from "@/lib/upstream";
import type { SessionUser } from "@/lib/types";

export const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/);
export const emailSchema = z.string().trim().email().max(254);

export function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function readBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

const meSchema = z.object({ id: z.string(), phone: z.string(), name: z.string().nullish(), points: z.number().nullish() });

/** Throws UpstreamError (e.g. 401 for an expired token). */
export async function loadSessionUser(token: string): Promise<SessionUser> {
  const me = meSchema.parse((await upstream<unknown>("/api/v2/users/me", { token })).data);
  let isMember = false;
  try {
    const balance = await upstream<{ has_active_membership?: unknown }>("/api/v2/invitations/balance", { token });
    isMember = balance.data?.has_active_membership === true;
  } catch {
    isMember = false;
  }
  return { id: me.id, name: me.name ?? "", phone: me.phone, points: me.points ?? 0, isMember };
}

export function authFailure(error: unknown): NextResponse {
  if (error instanceof UpstreamError) {
    if (error.status === 429) return fail(429, "rate_limited");
    // The one-time proof from verify-otp is spent or expired: a new code is needed, not a retyped one.
    if (error.status === 401 && error.code === "PHONE_NOT_VERIFIED") return fail(401, "verification_expired");
    if (error.status === 401) return fail(401, "otp_invalid");
    if (error.status === 403) return fail(403, "account_inactive");
    if (error.status === 409) return fail(409, "conflict");
    if (error.status === 400 || error.status === 422) return fail(400, "invalid_input");
  }
  return fail(503, "upstream_unavailable");
}
