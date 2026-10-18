import { NextResponse, type NextRequest } from "next/server";
import { createEntityIntent, upstreamFailure } from "@/app/api/checkout/shared";
import { isUuid } from "@/lib/season-pass";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { fail } from "../../shared";

export const runtime = "nodejs";

/** Moyasar intent for one PENDING_PAYMENT pass (one payment per pass). web-api checks the pass belongs to the shopper. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!isUuid(id)) return fail(400, "invalid_input");
  try {
    return NextResponse.json(await createEntityIntent(token, "SEASON_PASS", id), { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
