import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstream } from "@/lib/upstream";
import { isJsonRequest, setSessionCookie } from "@/lib/session";
import { authFailure, emailSchema, fail, loadSessionUser, phoneSchema, readBody } from "../shared";

export const runtime = "nodejs";
const schema = z.object({ phone: phoneSchema, name: z.string().trim().min(2).max(100), email: emailSchema.optional() });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  try {
    const { data } = await upstream<{ token?: unknown }>("/api/v2/auth/phone/register", { method: "POST", body: parsed.data });
    if (typeof data?.token !== "string") return fail(503, "upstream_unavailable");
    const user = await loadSessionUser(data.token);
    const response = NextResponse.json({ ok: true, user });
    setSessionCookie(response, data.token);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
