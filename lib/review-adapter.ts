import { z } from "zod";
import type { MyReview, Review, ReviewPage, ReviewSummary } from "./types";

const rating = z.number().int().min(1).max(5);
const publicSchema = z.object({
  id: z.string().min(1), rating, comment: z.string().nullish(), reviewer_name: z.string().nullish(),
  created_at: z.string(), updated_at: z.string(), is_mine: z.boolean().optional(),
});
const mySchema = z.object({
  id: z.string().min(1), rating, comment: z.string().nullish(), status: z.enum(["PUBLISHED", "HIDDEN"]),
  created_at: z.string(), updated_at: z.string(),
});
const summarySchema = z.object({
  avg_rating: z.number().min(0).max(5).nullable(), reviews_count: z.number().int().min(0),
  can_review: z.boolean(), my_review: z.unknown(),
});
const metaSchema = z.object({ page: z.number().int().min(1), totalCount: z.number().int().min(0), pagesCount: z.number().int().min(0) });

export function toReview(row: unknown): Review | null {
  const parsed = publicSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.id, rating: r.rating, comment: r.comment ?? null, reviewerName: r.reviewer_name ?? null, createdAt: r.created_at, updatedAt: r.updated_at, isMine: r.is_mine === true };
}

export function toMyReview(row: unknown): MyReview | null {
  const parsed = mySchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.id, rating: r.rating, comment: r.comment ?? null, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function toReviewSummary(row: unknown): ReviewSummary | null {
  const parsed = summarySchema.safeParse(row);
  if (!parsed.success) return null;
  const s = parsed.data;
  const myReview = s.my_review == null ? null : toMyReview(s.my_review);
  if (s.my_review != null && myReview === null) return null;
  return { average: s.reviews_count > 0 ? s.avg_rating : null, count: s.reviews_count, canReview: s.can_review, myReview };
}

export function toReviewPage(rows: unknown, meta: unknown): ReviewPage {
  const reviews = (Array.isArray(rows) ? rows : []).map(toReview).filter((review): review is Review => review !== null);
  const parsed = metaSchema.safeParse(meta);
  if (!parsed.success) return { reviews, page: 1, pages: 1, total: reviews.length };
  return { reviews, page: parsed.data.page, pages: parsed.data.pagesCount, total: parsed.data.totalCount };
}
