import { NextResponse, type NextRequest } from "next/server";
import { createEntityIntent, upstreamFailure, uuid } from "@/app/api/checkout/shared";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { UpstreamError } from "@/lib/upstream";
import { availableFrom, fail } from "../../shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return fail(400, "invalid_input");
  try {
    return NextResponse.json(await createEntityIntent(token, "EVENT", id), { status: 201 });
  } catch (error) {
    // The hold expired and the event filled up meanwhile (web-api 422).
    if (error instanceof UpstreamError && (error.code === "EVENT_FULLY_BOOKED" || error.code === "INSUFFICIENT_SLOTS")) {
      return fail(422, "booking_rejected", { code: error.code, available: availableFrom(error) });
    }
    return upstreamFailure(error);
  }
}
