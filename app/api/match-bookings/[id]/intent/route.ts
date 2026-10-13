import { NextResponse, type NextRequest } from "next/server";
import { createEntityIntent, upstreamFailure, uuid } from "@/app/api/checkout/shared";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { fail } from "../../shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return fail(400, "invalid_input");
  try {
    return NextResponse.json(await createEntityIntent(token, "MATCH_BOOKING", id), { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
