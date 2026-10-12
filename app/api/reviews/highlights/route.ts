import { NextResponse } from "next/server";
import { fetchReviewHighlights } from "@/lib/review-highlights";
import { UpstreamError } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ reviews: await fetchReviewHighlights() });
  } catch (error) {
    // An older web-api without the endpoint simply means there is nothing to show.
    if (error instanceof UpstreamError && error.status === 404) return NextResponse.json({ reviews: [] });
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
