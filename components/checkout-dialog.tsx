"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import type { CartItem, CheckoutResult, PreviewResult, Product, SessionUser, ShippingZone } from "../lib/types";
import { savePendingPayment } from "../lib/pending-payment";
import { CloseButton, Dialog } from "./dialog";
import "../app/account.css";

const CART_KEY = "ansar-store:cart:v2";
const money = (value: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;

const REJECTIONS: Record<string, string> = {
  CART_CHANGED: "تغيّرت بعض المنتجات أو خياراتها. راجع حقيبتك ثم حاول مجددًا.",
  MISSING_REQUIRED_ATTRIBUTE: "أحد الخيارات المطلوبة لم يعد متاحًا. راجع حقيبتك.",
  INVALID_OPTION: "أحد الخيارات لم يعد متاحًا. راجع حقيبتك.",
  SHIPPING_ZONE_REQUIRED: "اختر منطقة التوصيل.",
  DELIVERY_ADDRESS_REQUIRED: "اكتب عنوان التوصيل.",
  SHIPPING_FEE_CHANGED: "تغيّرت رسوم الشحن. راجعنا الإجمالي الجديد، أكّد الطلب مجددًا.",
  APP_UPDATE_REQUIRED: "تعذّر إنشاء الطلب الآن. حدّث الصفحة وحاول مجددًا.",
};
const COUPON_MESSAGES: Record<string, string> = {
  COUPON_NOT_FOUND: "رمز الخصم غير صحيح.", COUPON_EXPIRED: "انتهت صلاحية رمز الخصم.", COUPON_INACTIVE: "رمز الخصم غير مفعّل.",
  COUPON_MIN_ORDER_NOT_MET: "قيمة الطلب أقل من الحد الأدنى لهذا الرمز.", COUPON_WRONG_ORDER_TYPE: "هذا الرمز لا ينطبق على المتجر.",
  COUPON_NOT_ASSIGNED_TO_YOU: "هذا الرمز غير مخصص لحسابك.", COUPON_EXHAUSTED: "انتهت الاستخدامات المتاحة لرمز الخصم.", COUPON_ALREADY_USED_MAX: "استخدمت رمز الخصم هذا من قبل.",
};

async function send<T>(url: string, body?: unknown): Promise<{ status: number; data: T & { error?: string; code?: string } }> {
  try {
    const response = body === undefined
      ? await fetch(url, { cache: "no-store" })
      : await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  } catch {
    return { status: 0, data: { error: "upstream_unavailable" } as T & { error: string } };
  }
}

type Props = { open: boolean; onClose(): void; products: Product[]; cart: CartItem[]; user: SessionUser | null; onRequireSignIn(): void };

export function CheckoutDialog(props: Props) {
  return props.open ? <CheckoutContent {...props} /> : null;
}

function CheckoutContent({ onClose, cart, user, onRequireSignIn }: Props) {
  const titleId = useId();
  const [address, setAddress] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [shipping, setShipping] = useState<{ enabled: boolean; zones: ShippingZone[] } | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [couponNote, setCouponNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  // Latest callback without re-running effects when the parent passes a new function.
  const requireSignIn = useRef(onRequireSignIn);
  useEffect(() => { requireSignIn.current = onRequireSignIn; }, [onRequireSignIn]);
  // Only the newest preview request may update the totals; older replies are dropped.
  const previewSeq = useRef(0);

  const loadPreview = useCallback(async (code: string | undefined, zone: string) => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    const result = await send<PreviewResult>("/api/checkout/preview", {
      items: cart, ...(code ? { couponCode: code } : {}), ...(zone ? { shippingZoneId: zone } : {}),
    });
    if (seq !== previewSeq.current) return;
    setPreviewing(false);
    if (result.status === 401) { requireSignIn.current(); return; }
    if (result.status !== 200) { setError(REJECTIONS[result.data.code ?? ""] ?? "تعذّر حساب المبلغ الآن. حاول بعد قليل."); return; }
    setPreview(result.data);
    if (code && !result.data.couponValid) {
      setCouponNote(COUPON_MESSAGES[result.data.couponMessage ?? ""] ?? "رمز الخصم غير صالح.");
      setCoupon(undefined);
    } else {
      setCouponNote(code ? "طُبّق رمز الخصم." : "");
      setCoupon(code);
    }
  }, [cart]);

  useEffect(() => {
    if (!user) { requireSignIn.current(); return; }
    let active = true;
    void send<{ enabled: boolean; zones: ShippingZone[] }>("/api/shipping-zones").then((result) => {
      if (active) setShipping(result.status === 200 ? result.data : { enabled: false, zones: [] });
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || cart.length === 0 || shipping === null) return;
    void loadPreview(coupon, zoneId);
    // Recalculate only when the zone or cart changes; coupon changes call loadPreview directly.
  }, [user, cart, shipping, zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsZone = shipping?.enabled === true;
  const zoneMissing = needsZone && !zoneId;

  async function placeOrder(event: FormEvent) {
    event.preventDefault();
    if (address.trim().length < 10) { setError("اكتب عنوان التوصيل كاملًا (المدينة، الحي، الشارع)."); return; }
    if (zoneMissing) { setError(REJECTIONS.SHIPPING_ZONE_REQUIRED); return; }
    setBusy(true); setError("");
    const result = await send<CheckoutResult>("/api/checkout", {
      items: cart,
      deliveryAddress: address.trim(),
      ...(coupon ? { couponCode: coupon } : {}),
      ...(needsZone ? { shippingZoneId: zoneId, expectedShippingFee: preview?.shippingFee ?? 0 } : {}),
    });
    if (result.status === 401) { setBusy(false); requireSignIn.current(); return; }
    if (result.status !== 201) {
      setBusy(false);
      const code = result.data.code ?? "";
      setError(REJECTIONS[code] ?? COUPON_MESSAGES[code] ?? "تعذّر إرسال الطلب الآن. حاول بعد قليل.");
      if (code === "SHIPPING_FEE_CHANGED") void loadPreview(coupon, zoneId);
      return;
    }
    // The order now exists in web-api; the cart has done its job.
    try { localStorage.setItem(CART_KEY, "[]"); } catch { /* ignore */ }
    const order = result.data;
    if (!order.requiresPayment) { window.location.assign(`/orders?placed=${order.orderId}`); return; }
    if (order.payment) savePendingPayment(order.payment);
    window.location.assign(`/checkout/pay?order=${order.orderId}`);
  }

  return <Dialog open onClose={onClose} titleId={titleId} className="sd-policy">
    <header className="sd-header"><h2 id={titleId}>إتمام الطلب</h2><CloseButton onClose={onClose} /></header>
    <form className="acc-form" onSubmit={placeOrder} noValidate>
      {user && <p className="acc-note">الطلب باسم {user.name || user.phone}</p>}
      {needsZone && <label className="acc-field">منطقة التوصيل
        <select value={zoneId} onChange={(e) => { setZoneId(e.target.value); setError(""); }} style={{ font: "inherit", padding: "12px 14px", border: "1px solid var(--line,#e4e7e2)", borderRadius: 4, background: "#fff" }}>
          <option value="">اختر منطقتك</option>
          {shipping?.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} — {zone.fee === 0 ? "شحن مجاني" : money(zone.fee)}</option>)}
        </select></label>}
      <label className="acc-field">عنوان التوصيل<textarea value={address} maxLength={500} onChange={(e) => setAddress(e.target.value)} placeholder="المدينة، الحي، الشارع، رقم المبنى" /></label>
      <div className="acc-row">
        <label className="acc-field">رمز الخصم<input dir="ltr" value={couponInput} maxLength={64} onChange={(e) => setCouponInput(e.target.value)} /></label>
        <button type="button" className="acc-link" disabled={!couponInput.trim() || busy} onClick={() => void loadPreview(couponInput.trim(), zoneId)}>تطبيق</button>
      </div>
      {couponNote && <p className="acc-note" role="status">{couponNote}</p>}
      {preview && <div className="acc-summary">
        <div><span>المجموع</span><span>{money(preview.originalTotal)}</span></div>
        {preview.totalDiscount > 0 && <div><span>الخصم</span><span>− {money(preview.totalDiscount)}</span></div>}
        {preview.shippingEnabled && <div><span>الشحن</span><span>{zoneMissing ? "اختر المنطقة" : preview.shippingFee === 0 ? "مجاني" : money(preview.shippingFee)}</span></div>}
        {preview.shippingEnabled && !zoneMissing && preview.amountToFreeShipping !== null && preview.amountToFreeShipping > 0 && <p className="acc-note">أضف {money(preview.amountToFreeShipping)} لتحصل على شحن مجاني.</p>}
        <div className="acc-total"><span>الإجمالي</span><span>{money(preview.grandTotal)}</span></div>
      </div>}
      <p className="acc-note">المبلغ النهائي يؤكده النظام عند إنشاء الطلب ويظهر في صفحة الدفع.</p>
      {error && <p className="acc-error" role="alert">{error}</p>}
      <button className="acc-primary" type="submit" disabled={busy || previewing || cart.length === 0 || shipping === null || zoneMissing}>{busy ? "جارٍ إنشاء الطلب…" : "تأكيد الطلب والانتقال للدفع"}<ArrowLeft size={18} /></button>
    </form>
  </Dialog>;
}
