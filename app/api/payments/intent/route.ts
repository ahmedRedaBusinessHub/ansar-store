import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest } from "@/lib/session";
import { createIntent, fail, readBody, tokenOrNull, upstreamFailure, uuid } from "../../checkout/shared";

export const runtime = "nodejs";
const schema = z.object({ orderId: uuid });

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  try {
    return NextResponse.json(await createIntent(token, parsed.data.orderId), { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
