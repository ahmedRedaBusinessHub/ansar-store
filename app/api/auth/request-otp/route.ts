import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstream } from "@/lib/upstream";
import { isJsonRequest } from "@/lib/session";
import { authFailure, emailSchema, fail, phoneSchema, readBody } from "../shared";

export const runtime = "nodejs";
const schema = z.object({ phone: phoneSchema, email: emailSchema.optional() });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  try {
    const { data } = await upstream<{ requiresEmail?: unknown }>("/api/v2/auth/phone/request-otp", { method: "POST", body: parsed.data });
    return NextResponse.json({ ok: true, requiresEmail: data?.requiresEmail === true });
  } catch (error) {
    return authFailure(error);
  }
}
