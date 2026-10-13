"use client";

import { useId } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { CartItem, Product, SiteContent } from "../lib/types";
import { cartKey, MAX_PER_PRODUCT, unitPrice } from "../lib/cart";
import { CloseButton, Dialog } from "./dialog";
import "./shop-dialogs.css";

const money = (value: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;

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
