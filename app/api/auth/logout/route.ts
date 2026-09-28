import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, isJsonRequest } from "@/lib/session";
import { fail } from "../shared";

export const runtime = "nodejs";

// web-api has no member logout endpoint; the JWT simply stops being sent.
export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
