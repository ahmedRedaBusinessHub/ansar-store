"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import type { ReviewPage, ReviewSort, ReviewSummary, SessionUser } from "../lib/types";
import { formatAverage, REVIEW_SORTS, reviewCountLabel, reviewErrorMessage } from "../lib/reviews";
import { deleteMyReview, fetchReviewPage, fetchReviewSummary, saveMyReview } from "../lib/reviews-client";
import { ReviewForm, ReviewItem, Stars, type ReviewFormValues } from "./review-parts";
import "./product-reviews.css";

const SORT_LABELS: Record<ReviewSort, string> = { recent: "الأحدث", highest: "الأعلى تقييمًا", lowest: "الأقل تقييمًا" };

type ProductReviewsProps = { productId: string; user: SessionUser | null; onRequireSignIn: () => void };

export function ProductReviews({ productId, user, onRequireSignIn }: ProductReviewsProps) {
  const titleId = useId();
  const userId = user?.id ?? null;
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [listState, setListState] = useState<"loading" | "ready" | "failed">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const listSeq = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryFailed(false);
    void fetchReviewSummary(productId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setSummary(result.data);
      else setSummaryFailed(true);
    });
    return () => controller.abort();
  }, [productId, userId, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    listSeq.current += 1;
    setListState("loading");
    setLoadingMore(false);
    void fetchReviewPage(productId, sort, 1, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) { setPage(result.data); setListState("ready"); }
      else setListState("failed");
    });
    return () => controller.abort();
  }, [productId, sort, userId, reloadKey]);

  useEffect(() => { setEditing(false); setFormError(""); }, [userId]);

  const reload = () => setReloadKey((key) => key + 1);
  const startEditing = () => { setEditing(true); setFormError(""); setNotice(""); };

  const loadMore = async () => {
    if (!page || loadingMore) return;
    const seq = listSeq.current;
    const current = page;
    setLoadingMore(true);
    const result = await fetchReviewPage(productId, sort, current.page + 1);
    if (seq !== listSeq.current) return;
    setLoadingMore(false);
    if (!result.ok) { setNotice(reviewErrorMessage(result.error)); return; }
    const known = new Set(current.reviews.map((review) => review.id));
    setPage({ ...result.data, reviews: [...current.reviews, ...result.data.reviews.filter((review) => !known.has(review.id))] });
  };

  const submit = async (values: ReviewFormValues) => {
    const editingExisting = summary?.myReview != null;
    setBusy(true); setFormError(""); setNotice("");
    const result = await saveMyReview(productId, values);
    setBusy(false);
    if (!result.ok) {
      setFormError(reviewErrorMessage(result.error));
      if (result.error === "unauthenticated") onRequireSignIn();
      return;
    }
    setEditing(false);
    setNotice(editingExisting ? "حدّثنا تقييمك." : "شكرًا لك! نُشر تقييمك.");
    reload();
  };

  const remove = async () => {
    if (!window.confirm("هل تريد حذف تقييمك؟")) return;
    setBusy(true); setNotice("");
    const result = await deleteMyReview(productId);
    setBusy(false);
    if (!result.ok) {
      setNotice(reviewErrorMessage(result.error));
      if (result.error === "unauthenticated") onRequireSignIn();
      return;
    }
    setNotice("حذفنا تقييمك.");
    reload();
  };

  const count = summary?.count ?? 0;
  const average = summary?.average ?? null;
  const mine = summary?.myReview ?? null;

  return <section className="pr-section" aria-labelledby={titleId}>
    <div className="pr-head">
      <h3 id={titleId} className="pr-title">تقييمات المشترين</h3>
      {summary && (count > 0 && average !== null
        ? <div className="pr-summary"><strong className="pr-average">{formatAverage(average)}</strong><Stars value={average} /><span className="pr-count">{reviewCountLabel(count)}</span></div>
        : <span className="pr-count">{reviewCountLabel(0)}</span>)}
    </div>

    <div className="pr-write">
      {!user ? <div className="pr-note"><span>شاركنا رأيك في المنتج بعد استلام طلبك.</span><button type="button" className="sd-text-button" onClick={onRequireSignIn}>سجّل الدخول لكتابة تقييم</button></div>
        : summaryFailed ? <p className="pr-error">تعذّر تحميل حالة تقييمك.<button type="button" className="sd-text-button" onClick={reload}>إعادة المحاولة</button></p>
        : !summary ? null
        : editing ? <ReviewForm key={mine?.id ?? "new"} initialRating={mine?.rating ?? 0} initialComment={mine?.comment ?? null}
            submitLabel={mine ? "حفظ التعديل" : "نشر التقييم"} busy={busy} serverError={formError}
            onSubmit={(values) => void submit(values)} onCancel={() => { setEditing(false); setFormError(""); }} />
        : mine ? <div className={`pr-mine${mine.status === "HIDDEN" ? " is-hidden" : ""}`}>
            <div className="pr-item-head"><Stars value={mine.rating} size={14} /><span className="pr-name">تقييمك</span></div>
            {mine.comment && <p className="pr-comment">{mine.comment}</p>}
            {mine.status === "HIDDEN"
              ? <p className="pr-hidden-note">أخفت الإدارة هذا التقييم، لذا لا يظهر للآخرين ولا يمكن تعديله أو حذفه.</p>
              : <div className="pr-mine-actions">
                  <button type="button" className="pr-button" disabled={busy} onClick={startEditing}><Pencil size={16} />تعديل</button>
                  <button type="button" className="pr-button pr-button-danger" disabled={busy} onClick={() => void remove()}><Trash2 size={16} />حذف</button>
                </div>}
          </div>
        : summary.canReview ? <button type="button" className="pr-button" onClick={startEditing}><MessageSquare size={16} />اكتب تقييمك</button>
        : <p className="pr-note">يمكنك تقييم هذا المنتج بعد استلام طلب يحتويه.</p>}
      {notice && <p className="pr-notice" role="status">{notice}</p>}
    </div>

    {count > 1 && <label className="pr-sort"><span>الترتيب:</span>
      <select value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)}>
        {REVIEW_SORTS.map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
      </select>
    </label>}

    {listState === "loading" && !page ? <p className="pr-loading" role="status">جارٍ تحميل التقييمات…</p>
      : listState === "failed" ? <p className="pr-error">تعذّر تحميل التقييمات.<button type="button" className="sd-text-button" onClick={reload}>إعادة المحاولة</button></p>
      : page && page.reviews.length > 0 ? <>
          <ul className="pr-list" aria-busy={listState === "loading"}>{page.reviews.map((review) => <ReviewItem key={review.id} review={review} />)}</ul>
          {page.page < page.pages && <button type="button" className="pr-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "جارٍ التحميل…" : "عرض المزيد من التقييمات"}</button>}
        </>
      : <p className="pr-empty">كن أول من يقيّم هذا المنتج بعد الشراء.</p>}
  </section>;
}
