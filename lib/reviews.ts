import type { ReviewSort } from "./types";

// Dependency-free review helpers: safe to import from client components (no zod, no next/server).
export const REVIEW_SORTS = ["recent", "highest", "lowest"] as const satisfies readonly ReviewSort[];
export const REVIEWS_PER_PAGE = 5;

// Mirrors web-api normalizeReviewComment (apps/web-api/lib/api/services/store-review-service.ts).
export const REVIEW_COMMENT_MIN = 5;
export const REVIEW_COMMENT_MAX = 1000;
// Everything below U+0020 except \n, plus DEL. \r is normalized to \n first.
const FORBIDDEN_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F]/;

export type CommentError = "comment_too_short" | "comment_too_long" | "comment_invalid_chars";
export type CommentCheck = { ok: true; comment: string | null } | { ok: false; error: CommentError };

export function checkComment(raw: string | null | undefined): CommentCheck {
  if (raw == null) return { ok: true, comment: null };
  const text = raw.replace(/\r\n?/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
  if (text.length === 0) return { ok: true, comment: null };
  if (FORBIDDEN_CHARS.test(text)) return { ok: false, error: "comment_invalid_chars" };
  const length = Array.from(text).length;
  if (length < REVIEW_COMMENT_MIN) return { ok: false, error: "comment_too_short" };
  if (length > REVIEW_COMMENT_MAX) return { ok: false, error: "comment_too_long" };
  return { ok: true, comment: text };
}

const REVIEW_ERRORS: Record<string, string> = {
  invalid_input: "تحقّق من التقييم والتعليق ثم حاول مجددًا.",
  unauthenticated: "انتهت جلستك. سجّل الدخول مجددًا ثم أعد المحاولة.",
  forbidden: "لا يمكن تنفيذ هذا الإجراء بهذا الحساب.",
  not_verified_buyer: "التقييم متاح لمن اشترى المنتج واستلم طلبه.",
  review_hidden: "أخفت الإدارة تقييمك، لذا لا يمكن تعديله أو حذفه.",
  not_found: "لم نعد نجد هذا المنتج أو التقييم.",
  comment_too_short: `التعليق قصير جدًا. اكتب ${REVIEW_COMMENT_MIN} أحرف على الأقل أو اتركه فارغًا.`,
  comment_too_long: `التعليق طويل جدًا. الحد الأقصى ${REVIEW_COMMENT_MAX} حرف.`,
  comment_invalid_chars: "التعليق يحتوي على رموز غير مسموحة.",
  rate_limited: "محاولات كثيرة. حاول بعد دقيقة.",
  upstream_unavailable: "الخدمة غير متاحة الآن. حاول بعد قليل.",
};

export function reviewErrorMessage(code: string | null | undefined): string {
  return code && Object.hasOwn(REVIEW_ERRORS, code) ? REVIEW_ERRORS[code] : REVIEW_ERRORS.upstream_unavailable;
}

export function reviewerLabel(name: string | null): string {
  return name?.trim() || "عضو سابق";
}

const averageFormat = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function formatAverage(value: number): string {
  return averageFormat.format(value);
}

const dateFormat = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" });
export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

const plural = new Intl.PluralRules("ar");
export function reviewCountLabel(count: number): string {
  switch (plural.select(count)) {
    case "zero": return "لا توجد تقييمات";
    case "one": return "تقييم واحد";
    case "two": return "تقييمان";
    case "few": return `${count} تقييمات`;
    case "many": return `${count} تقييمًا`;
    default: return `${count} تقييم`;
  }
}
