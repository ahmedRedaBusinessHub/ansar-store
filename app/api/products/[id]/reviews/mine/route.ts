import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readBody, uuid } from "@/app/api/checkout/shared";
import { reviewFail, reviewUpstreamFailure } from "@/app/api/products/[id]/reviews/shared";
import { toMyReview } from "@/lib/review-adapter";
import { checkComment } from "@/lib/reviews";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(4000).nullable().optional(),
}).strict();

/** Create or edit the member's review. web-api decides who is a verified buyer. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return reviewFail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return reviewFail(401, "unauthenticated");
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await readBody(request));
  if (!uuid.safeParse(id).success || !parsed.success) return reviewFail(400, "invalid_input");
  const comment = checkComment(parsed.data.comment);
  if (!comment.ok) return reviewFail(422, comment.error);
  try {
    const { data } = await upstream<unknown>(`/api/v2/store/${id}/reviews/mine`, {
      method: "PUT", token, body: { rating: parsed.data.rating, comment: comment.comment },
    });
    const review = toMyReview(data);
    return review ? NextResponse.json(review) : reviewFail(503, "upstream_unavailable");
  } catch (error) {
    return reviewUpstreamFailure(error);
  }
}

/** Remove the member's review. A cross-site page cannot send DELETE with the SameSite=lax session cookie, so no JSON guard is needed. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = getSessionToken(request);
  if (!token) return reviewFail(401, "unauthenticated");
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return reviewFail(400, "invalid_input");
  try {
    await upstream<null>(`/api/v2/store/${id}/reviews/mine`, { method: "DELETE", token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return reviewUpstreamFailure(error);
  }
}
