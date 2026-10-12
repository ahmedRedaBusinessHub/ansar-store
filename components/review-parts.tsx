"use client";

import { useId, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import type { Review } from "../lib/types";
import { checkComment, formatAverage, formatReviewDate, REVIEW_COMMENT_MAX, reviewErrorMessage, reviewerLabel } from "../lib/reviews";

const STEPS = [1, 2, 3, 4, 5];

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return <span className="pr-stars" role="img" aria-label={`${formatAverage(value)} من 5`}>
    {STEPS.map((step) => <Star key={step} size={size} aria-hidden="true" className={step <= filled ? "pr-star-on" : "pr-star-off"} fill={step <= filled ? "currentColor" : "none"} />)}
  </span>;
}

export function RatingInput({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const name = useId();
  return <fieldset className="pr-rating-input" disabled={disabled}>
    <legend>تقييمك <span>(مطلوب)</span></legend>
    <div className="pr-rating-options">
      {STEPS.map((step) => <label key={step} className={`pr-rating-option${step <= value ? " is-on" : ""}`}>
        <input type="radio" className="sr-only" name={name} value={step} checked={value === step} onChange={() => onChange(step)} />
        <Star size={28} aria-hidden="true" fill={step <= value ? "currentColor" : "none"} />
        <span className="sr-only">{step} من 5</span>
      </label>)}
    </div>
  </fieldset>;
}

export type ReviewFormValues = { rating: number; comment: string | null };

type ReviewFormProps = {
  initialRating?: number; initialComment?: string | null; submitLabel: string; busy: boolean; serverError: string;
  onSubmit: (values: ReviewFormValues) => void; onCancel: () => void;
};

export function ReviewForm({ initialRating = 0, initialComment = null, submitLabel, busy, serverError, onSubmit, onCancel }: ReviewFormProps) {
  const commentId = useId();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment ?? "");
  const [localError, setLocalError] = useState("");
  const error = localError || serverError;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (rating < 1) { setLocalError("اختر عدد النجوم أولًا."); return; }
    const checked = checkComment(comment);
    if (!checked.ok) { setLocalError(reviewErrorMessage(checked.error)); return; }
    setLocalError("");
    onSubmit({ rating, comment: checked.comment });
  };

  return <form className="pr-form" onSubmit={submit} noValidate>
    <RatingInput value={rating} disabled={busy} onChange={(value) => { setRating(value); setLocalError(""); }} />
    <label className="pr-field" htmlFor={commentId}>تعليقك <span>(اختياري)</span></label>
    <textarea id={commentId} className="pr-textarea" rows={4} maxLength={REVIEW_COMMENT_MAX} value={comment} disabled={busy}
      placeholder="ما الذي أعجبك؟ وكيف كان المقاس والجودة؟" onChange={(event) => { setComment(event.target.value); setLocalError(""); }} />
    <p className="pr-counter">{Array.from(comment).length} / {REVIEW_COMMENT_MAX}</p>
    {error && <p className="pr-form-error" role="alert">{error}</p>}
    <div className="pr-form-actions">
      <button type="submit" className="sd-primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : submitLabel}</button>
      <button type="button" className="sd-text-button" disabled={busy} onClick={onCancel}>إلغاء</button>
    </div>
  </form>;
}

export function ReviewItem({ review }: { review: Review }) {
  return <li className="pr-item">
    <div className="pr-item-head">
      <Stars value={review.rating} size={14} />
      <span className="pr-name">{reviewerLabel(review.reviewerName)}{review.isMine && <span className="pr-mine-badge">تقييمك</span>}</span>
      <time className="pr-date" dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
    </div>
    {review.comment && <p className="pr-comment">{review.comment}</p>}
  </li>;
}
