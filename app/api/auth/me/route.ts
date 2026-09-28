import { NextResponse, type NextRequest } from "next/server";
import { UpstreamError } from "@/lib/upstream";
import { clearSessionCookie, getSessionToken } from "@/lib/session";
import { fail, loadSessionUser } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ user: null });
  try {
    return NextResponse.json({ user: await loadSessionUser(token) });
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 401) {
      const response = NextResponse.json({ user: null });
      clearSessionCookie(response);
      return response;
    }
    return fail(503, "upstream_unavailable");
  }
}
