import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstream } from "@/lib/upstream";
import { isJsonRequest, setSessionCookie } from "@/lib/session";
import { authFailure, emailSchema, fail, loadSessionUser, phoneSchema, readBody } from "../shared";

export const runtime = "nodejs";
const schema = z.object({ phone: phoneSchema, otp: z.string().regex(/^\d{4,8}$/), email: emailSchema.optional() });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  try {
    const { data } = await upstream<{ token?: unknown; isNewUser?: unknown; pending_deletion?: unknown }>(
      "/api/v2/auth/phone/verify-otp", { method: "POST", body: parsed.data });
    // Accounts pending deletion get a recovery-only token; recovery happens in the mobile app.
    if (data?.pending_deletion === true) return fail(403, "account_inactive");
    if (typeof data?.token !== "string") {
      return data?.isNewUser === true ? NextResponse.json({ ok: true, isNewUser: true, user: null }) : fail(503, "upstream_unavailable");
    }
    const user = await loadSessionUser(data.token);
    const response = NextResponse.json({ ok: true, isNewUser: false, user });
    setSessionCookie(response, data.token);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
