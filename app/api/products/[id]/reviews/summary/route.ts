import { NextResponse, type NextRequest } from "next/server";
import { uuid } from "@/app/api/checkout/shared";
import { reviewFail, reviewUpstreamFailure } from "@/app/api/products/[id]/reviews/shared";
import { toReviewSummary } from "@/lib/review-adapter";
import { getSessionToken } from "@/lib/session";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Average, count and — for a signed-in member — can_review + their own review. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return reviewFail(400, "invalid_input");
  try {
    const { data } = await upstream<unknown>(`/api/v2/store/${id}/reviews/summary`, { token: getSessionToken(request) });
    const summary = toReviewSummary(data);
    return summary ? NextResponse.json(summary) : reviewFail(503, "upstream_unavailable");
  } catch (error) {
    return reviewUpstreamFailure(error);
  }
}
