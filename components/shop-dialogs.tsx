"use client";

import { useId, useState } from "react";
import { ArrowLeft, Heart, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { CartItem, Product, SiteContent } from "../lib/types";
import { cartKey, MAX_PER_PRODUCT, productPriceRange, unitPrice, validOptionIds } from "../lib/cart";
import { CloseButton, Dialog } from "./dialog";
import "./shop-dialogs.css";

const money = (value: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;

type ProductDialogProps = {
  product: Product | null; onClose: () => void; onAdd: (id: string, optionIds: string[]) => boolean;
  wishlist: string[]; onToggleWishlist: (id: string) => void;
};

export function ProductDialog(props: ProductDialogProps) {
  return props.product ? <ProductContent key={props.product.id} {...props} product={props.product} /> : null;
}

function ProductContent({ product, onClose, onAdd, wishlist, onToggleWishlist }: ProductDialogProps & { product: Product }) {
  const titleId = useId();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState(product.image);
  const [message, setMessage] = useState("");
  const optionIds = Object.values(choices);
  const complete = validOptionIds(product, optionIds) !== null;
  const priceRange = productPriceRange(product);
  const displayedPrice = complete ? unitPrice(product, optionIds) : priceRange.minimum;
  const missing = product.optionGroups.filter((group) => group.required && !choices[group.id]).map((group) => group.name);
  const selected = wishlist.includes(product.id);

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

  return <Dialog open onClose={onClose} titleId={titleId} className="sd-product">
    <div className="sd-product-close"><CloseButton onClose={onClose} /></div>
    <div className="sd-product-grid">
      <div className="sd-gallery">
        <div className="sd-main-photo"><img src={photo} alt={product.name} /></div>
        {product.images.length > 1 && <div className="sd-thumbnails" aria-label="صور المنتج">
          {product.images.map((src, index) => <button key={src} type="button" aria-label={`عرض صورة المنتج ${index + 1}`} aria-pressed={src === photo} onClick={() => setPhoto(src)}><img src={src} alt="" /></button>)}
        </div>}
      </div>
      <div className="sd-product-info">
        <h2 id={titleId}>{product.name}</h2>
        <div className="sd-price">{!complete && priceRange.variable && <small>يبدأ من</small>}<strong>{money(displayedPrice)}</strong></div>
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
          const success = onAdd(product.id, optionIds);
          if (!success) setMessage(`وصلت إلى الحد المتاح (${MAX_PER_PRODUCT} قطع) من هذا المنتج`);
        }}><ShoppingBag size={20} />أضف إلى الحقيبة</button>
          <button type="button" className="sd-icon sd-heart" aria-label={selected ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} aria-pressed={selected} title={selected ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} onClick={() => onToggleWishlist(product.id)}><Heart size={22} fill={selected ? "currentColor" : "none"} /></button>
        </div>
        <p className="sd-message" role="status">{message || (missing.length > 0 ? `اختر: ${missing.join("، ")}` : "")}</p>
      </div>
    </div>
  </Dialog>;
}

type CartDialogProps = {
  open: boolean; onClose: () => void; products: Product[]; cart: CartItem[];
  totals: { subtotal: number; shipping: number; total: number };
  onQuantity: (key: string, quantity: number) => void; onCheckout: () => void;
};

export function CartDialog(props: CartDialogProps) {
  return props.open ? <CartContent {...props} /> : null;
}

function CartContent({ onClose, products, cart, totals, onQuantity, onCheckout }: CartDialogProps) {
  const titleId = useId();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  return <Dialog open onClose={onClose} titleId={titleId} className="sd-cart">
    <header className="sd-header"><h2 id={titleId}>حقيبتك <span>({count})</span></h2><CloseButton onClose={onClose} /></header>
    {!cart.length ? <div className="sd-empty"><ShoppingBag size={54} strokeWidth={1} /><h3>حقيبتك بانتظار الأخضر</h3><p>اختر القطعة التي تعبّر عن انتمائك.</p><button type="button" className="sd-primary" onClick={onClose}>اكتشف المجموعة<ArrowLeft size={18} /></button></div> : <>
      <div className="sd-cart-scroll">
        <ul className="sd-cart-items">{cart.map((item) => {
          const product = products.find((candidate) => candidate.id === item.id);
          if (!product) return null;
          const key = cartKey(item);
          const labels = product.optionGroups.flatMap((group) => group.options.filter((option) => item.optionIds.includes(option.id)).map((option) => `${group.name}: ${option.label}`));
          const aggregate = cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0);
          return <li className="sd-cart-item" key={key}>
            <img src={product.image} alt={product.name} />
            <div className="sd-line-info"><h3>{product.name}</h3>{labels.map((label) => <p key={label}>{label}</p>)}<strong>{money(unitPrice(product, item.optionIds) * item.quantity)}</strong>
              <div className="sd-line-actions"><div className="sd-quantity">
                <button type="button" aria-label={`تقليل كمية ${product.name}`} title="تقليل الكمية" onClick={() => onQuantity(key, item.quantity - 1)}><Minus size={15} /></button>
                <span aria-live="polite">{item.quantity}</span>
                <button type="button" aria-label={`زيادة كمية ${product.name}`} title="زيادة الكمية" disabled={aggregate >= MAX_PER_PRODUCT} onClick={() => onQuantity(key, item.quantity + 1)}><Plus size={15} /></button>
              </div>
                <button type="button" className="sd-icon sd-remove" aria-label={`حذف ${product.name}`} title="حذف المنتج" onClick={() => onQuantity(key, 0)}><Trash2 size={18} /></button></div>
            </div>
          </li>;
        })}</ul>
      </div>
      <footer className="sd-cart-footer"><dl><div className="sd-total"><dt>المجموع</dt><dd>{money(totals.total)}</dd></div></dl>
        <button type="button" className="sd-primary" onClick={onCheckout}>إتمام الطلب<ArrowLeft size={19} /></button>
        <p className="sd-demo-note">تُحتسب الخصومات والمبلغ النهائي في الخطوة التالية.</p></footer>
    </>}
  </Dialog>;
}

export function InfoDialog({ policy, onClose }: { policy: SiteContent["policies"][number] | null; onClose: () => void }) {
  const titleId = useId();
  return policy ? <Dialog open onClose={onClose} titleId={titleId} className="sd-policy"><header className="sd-header"><h2 id={titleId}>{policy.title}</h2><CloseButton onClose={onClose} /></header><div className="sd-policy-body">{policy.body}</div></Dialog> : null;
}
