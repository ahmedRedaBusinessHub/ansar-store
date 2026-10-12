import { z } from "zod";
import { upstream } from "./upstream";

export type ReviewHighlight = { id: string; rating: number; comment: string; reviewerName: string | null; createdAt: string; productId: string };

export const HIGHLIGHTS_LIMIT = 8;
const CACHE_MS = 5 * 60_000;
let cache: { at: number; highlights: ReviewHighlight[] } | null = null;

export function resetHighlightsCache(): void {
  cache = null;
}

const rowSchema = z.object({
  id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1),
  reviewer_name: z.string().nullish(),
  created_at: z.string(),
  product: z.object({ id: z.string().min(1) }),
});

export function toReviewHighlight(row: unknown): ReviewHighlight | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.id, rating: r.rating, comment: r.comment, reviewerName: r.reviewer_name ?? null, createdAt: r.created_at, productId: r.product.id };
}

/** Latest positive reviews for the home page. Cached 5 minutes; when web-api fails the last good list is served. */
export async function fetchReviewHighlights(): Promise<ReviewHighlight[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.highlights;
  try {
    const { data } = await upstream<unknown>(`/api/v2/store/reviews/highlights?limit=${HIGHLIGHTS_LIMIT}`);
    const highlights = (Array.isArray(data) ? data : []).map(toReviewHighlight).filter((item): item is ReviewHighlight => item !== null);
    cache = { at: Date.now(), highlights };
    return highlights;
  } catch (error) {
    if (cache) return cache.highlights;
    throw error;
  }
}
