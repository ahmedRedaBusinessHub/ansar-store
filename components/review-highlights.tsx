"use client";

import { useEffect, useState } from "react";
import { ArrowUpLeft, Quote } from "lucide-react";
import type { Product } from "../lib/types";
import type { ReviewHighlight } from "../lib/review-highlights";
import { formatReviewDate, reviewerLabel } from "../lib/reviews";
import { Stars } from "./review-parts";
import "./product-reviews.css";
import "./review-highlights.css";

type ReviewHighlightsProps = { products: Product[]; onOpenProduct: (product: Product) => void };

export function ReviewHighlights({ products, onOpenProduct }: ReviewHighlightsProps) {
  const [highlights, setHighlights] = useState<ReviewHighlight[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/reviews/highlights", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { reviews?: unknown } | null) => { if (Array.isArray(body?.reviews)) setHighlights(body.reviews as ReviewHighlight[]); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cards = highlights.flatMap((review) => {
    const product = products.find((candidate) => candidate.id === review.productId);
    return product ? [{ review, product }] : [];
  });
  if (cards.length === 0) return null;

  return <section className="review-highlights section-shell" aria-labelledby="review-highlights-title">
    <div className="section-heading"><div><span className="section-kicker">بكلمات الأنصار</span><h2 id="review-highlights-title">آراء عملائنا<span className="heading-dot">.</span></h2><p>تقييمات حقيقية من مشترين استلموا طلباتهم.</p></div></div>
    <ul className="rh-list">{cards.map(({ review, product }) => <li key={review.id} className="rh-card">
      <Quote className="rh-quote" size={26} aria-hidden="true" />
      <Stars value={review.rating} size={15} />
      <p className="rh-comment">{review.comment}</p>
      <div className="rh-meta"><b>{reviewerLabel(review.reviewerName)}</b><time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time></div>
      <button type="button" className="rh-product" aria-label={`عرض ${product.name}`} onClick={() => onOpenProduct(product)}><img src={product.image} alt="" loading="lazy" /><span>{product.name}</span><ArrowUpLeft size={16} aria-hidden="true" /></button>
    </li>)}</ul>
  </section>;
}
