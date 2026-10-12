import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { uuid } from "@/app/api/checkout/shared";
import { reviewFail, reviewUpstreamFailure } from "@/app/api/products/[id]/reviews/shared";
import { toReviewPage } from "@/lib/review-adapter";
import { REVIEW_SORTS, REVIEWS_PER_PAGE } from "@/lib/reviews";
import { getSessionToken } from "@/lib/session";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  sort: z.enum(REVIEW_SORTS).optional(),
  page: z.string().regex(/^[1-9]\d{0,3}$/).optional(),
});

/** Published reviews of one product, REVIEWS_PER_PAGE per page. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = request.nextUrl.searchParams;
  const query = querySchema.safeParse({ sort: params.get("sort") ?? undefined, page: params.get("page") ?? undefined });
  if (!uuid.safeParse(id).success || !query.success) return reviewFail(400, "invalid_input");
  const search = new URLSearchParams({ sort: query.data.sort ?? "recent", page: query.data.page ?? "1", perPage: String(REVIEWS_PER_PAGE) });
  try {
    // The token is optional: with it web-api flags the caller's own review (is_mine).
    const { data, meta } = await upstream<unknown>(`/api/v2/store/${id}/reviews?${search}`, { token: getSessionToken(request) });
    return NextResponse.json(toReviewPage(data, meta));
  } catch (error) {
    return reviewUpstreamFailure(error);
  }
}
