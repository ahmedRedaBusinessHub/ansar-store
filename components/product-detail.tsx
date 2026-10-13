"use client";

import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Share2, ShoppingBag, ZoomIn } from "lucide-react";
import type { Product } from "@/lib/types";
import { MAX_PER_PRODUCT, productPriceRange, unitPrice, validOptionIds } from "@/lib/cart";
import { offerFor } from "@/lib/offer";
import { productShareText, productUrl } from "@/lib/product-seo";
import { CloseButton, Dialog } from "./dialog";
import { ProductReviews } from "./product-reviews";
import type { StoreShellApi } from "./store-shell";
import "./shop-dialogs.css";
import "./product-detail.css";

const money = (value: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;

export function ProductDetail({ product, api }: { product: Product; api: StoreShellApi }) {
  const titleId = useId();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState(product.image);
  const [message, setMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const optionIds = Object.values(choices);
  const complete = validOptionIds(product, optionIds) !== null;
  const priceRange = productPriceRange(product);
  const displayedPrice = complete ? unitPrice(product, optionIds) : priceRange.minimum;
  // Follows the chosen options: the struck original moves by the same extras.
  const offer = offerFor(product, displayedPrice);
  const missing = product.optionGroups.filter((group) => group.required && !choices[group.id]).map((group) => group.name);
  const selected = api.shop.wishlist.includes(product.id);

  // One option per group (web-api rejects more); null clears an optional group.
  const choose = (groupId: string, optionId: string | null) => {
    setChoices((current) => {
      const next = { ...current };
      if (optionId === null) delete next[groupId];
      else next[groupId] = optionId;
      return next;
    });
    setMessage("");
  };

  const currentIndex = product.images.indexOf(photo);
  const hasMultiple = product.images.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    setPhoto(product.images[(currentIndex - 1 + product.images.length) % product.images.length]);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    setPhoto(product.images[(currentIndex + 1) % product.images.length]);
  };

  // Native share sheet on phones; copy the link elsewhere. Never throws.
  const share = async () => {
    const url = productUrl(product.id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: product.name, text: productShareText(product), url });
      } catch {
        // The shopper closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      api.showToast("نسخنا رابط المنتج");
    } catch {
      api.showToast("تعذّر نسخ الرابط");
    }
  };

  return <>
    <section className="sd-dialog pd-product" aria-labelledby={titleId}>
      <div className="sd-product-grid">
        <div className="sd-gallery">
          <div className="sd-main-photo">
            <img src={photo} alt={product.name} onClick={() => setIsFullscreen(true)} style={{ cursor: "zoom-in" }} />
            <button type="button" className="sd-zoom" aria-label="عرض بملء الشاشة" onClick={() => setIsFullscreen(true)}><ZoomIn size={22} /></button>
          </div>
          {product.images.length > 1 && <div className="sd-thumbnails" aria-label="صور المنتج">
            {product.images.map((src, index) => <button key={src} type="button" aria-label={`عرض صورة المنتج ${index + 1}`} aria-pressed={src === photo} onClick={() => setPhoto(src)}><img src={src} alt="" /></button>)}
          </div>}
        </div>
        <div className="sd-product-info">
          <h1 id={titleId}>{product.name}</h1>
          <div className="sd-price">{!complete && priceRange.variable && <small>يبدأ من</small>}<strong>{money(displayedPrice)}</strong>{offer && <><del aria-label={`السعر قبل العرض ${money(offer.original)}`}>{money(offer.original)}</del><em className="sd-offer-badge">وفّر {offer.percentOff}٪</em></>}</div>
          {product.description && <p className="sd-description" style={{ whiteSpace: "pre-line" }}>{product.description}</p>}
          {product.optionGroups.map((group) => <fieldset key={group.id} className="sd-size-field">
            <legend>{group.name} <span>{group.options.find((option) => option.id === choices[group.id])?.label ?? (group.required ? "اختر" : "اختياري")}</span></legend>
            <div className="sd-sizes" role="group" aria-label={group.name}>
              {!group.required && <button type="button" aria-pressed={!choices[group.id]}
                className={!choices[group.id] ? "sd-selected" : ""} onClick={() => choose(group.id, null)}>بدون</button>}
              {group.options.map((option) => <button key={option.id} type="button"
                aria-pressed={choices[group.id] === option.id} className={choices[group.id] === option.id ? "sd-selected" : ""}
                onClick={() => choose(group.id, option.id)}>{option.label}{option.extra > 0 ? ` (+${option.extra})` : ""}</button>)}
            </div>
          </fieldset>)}
          <div className="sd-add-row"><button type="button" className="sd-primary" disabled={!complete} onClick={() => {
            const success = api.addToCart(product.id, optionIds);
            if (!success) setMessage(`وصلت إلى الحد المتاح (${MAX_PER_PRODUCT} قطع) من هذا المنتج`);
          }}><ShoppingBag size={20} />أضف إلى الحقيبة</button>
            <button type="button" className="sd-icon sd-heart" aria-label={selected ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} aria-pressed={selected} title={selected ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} onClick={() => api.toggleFavorite(product.id)}><Heart size={22} fill={selected ? "currentColor" : "none"} /></button>
            <button type="button" className="sd-icon sd-heart" aria-label="مشاركة المنتج" title="مشاركة" onClick={() => void share()}><Share2 size={22} /></button>
          </div>
          <p className="sd-message" role="status">{message || (missing.length > 0 ? `اختر: ${missing.join("، ")}` : "")}</p>
        </div>
      </div>
      <ProductReviews productId={product.id} user={api.session.user} onRequireSignIn={api.openAuth} />
    </section>
    {isFullscreen && (
      <Dialog open onClose={() => setIsFullscreen(false)} titleId={`${titleId}-fs`} className="sd-fullscreen">
        <div className="sd-fs-close"><CloseButton onClose={() => setIsFullscreen(false)} /></div>
        <div className="sd-fs-content" onClick={() => setIsFullscreen(false)}>
          <img src={photo} alt={product.name} onClick={(e) => e.stopPropagation()} />
          {hasMultiple && <>
            <button type="button" className="sd-fs-nav sd-fs-prev" aria-label="السابق" onClick={handlePrev}><ChevronRight size={32} /></button>
            <button type="button" className="sd-fs-nav sd-fs-next" aria-label="التالي" onClick={handleNext}><ChevronLeft size={32} /></button>
          </>}
        </div>
      </Dialog>
    )}
  </>;
}
