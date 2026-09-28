"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PENDING_PAYMENT_KEY, readPendingPayment, type PendingPayment } from "../../../lib/pending-payment";
import { moyasarMethodConfig, readMethodFlags } from "../../../lib/payment-methods";
import TamaraOption from "./tamara-option";

declare global {
  interface Window { Moyasar?: { init(config: Record<string, unknown>): void } }
}

const MPF_VERSION = "1.14.0";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

function loadMoyasar(): Promise<void> {
  if (window.Moyasar) return Promise.resolve();
  if (!document.querySelector("link[data-moyasar]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.css`; link.dataset.moyasar = "1";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("moyasar"));
    document.body.appendChild(script);
  });
}

export default function PayClient() {
  const orderId = useSearchParams().get("order") ?? "";
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!UUID.test(orderId)) { setError("رابط الدفع غير صالح."); return; }
    // An intent saved by the checkout dialog is used once; a reload always creates a fresh intent
    // (web-api fails the previous INITIATED intent itself).
    const saved = readPendingPayment();
    try { sessionStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
    if (saved && saved.metadata.entity_id === orderId) { setPayment(saved); return; }
    fetch("/api/payments/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) { setError("سجّل الدخول من صفحة المتجر ثم عد لإكمال الدفع."); return; }
        if (!response.ok) { setError(body?.code === "INVALID_STATUS" ? "هذا الطلب مدفوع أو لم يعد قابلًا للدفع." : "تعذّر تجهيز الدفع الآن. حاول بعد قليل."); return; }
        setPayment(body as PendingPayment);
      })
      .catch(() => setError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا."));
  }, [orderId]);

  useEffect(() => {
    if (!payment) return;
    const key = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
    if (!key) { setError("الدفع الإلكتروني غير مهيأ بعد."); return; }
    const site = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "");
    // NEXT_PUBLIC_* must be referenced literally so Next inlines them at build time.
    const methodConfig = moyasarMethodConfig(
      readMethodFlags({ stcPay: process.env.NEXT_PUBLIC_STCPAY_ENABLED, applePay: process.env.NEXT_PUBLIC_APPLE_PAY_ENABLED }),
      process.env.NEXT_PUBLIC_APPLE_PAY_LABEL ?? "",
    );
    loadMoyasar().then(() => {
      window.Moyasar?.init({
        element: ".mysr-form",
        amount: payment.amountHalalah,
        currency: payment.currency,
        description: payment.description,
        publishable_api_key: key,
        callback_url: `${site}/checkout/result?payment=${payment.paymentId}&order=${orderId}`,
        ...methodConfig,
        language: "ar",
        metadata: payment.metadata,
      });
    }).catch(() => setError("تعذّر تحميل نموذج الدفع. حاول مجددًا."));
  }, [payment, orderId]);

  return <main className="co-shell" dir="rtl">
    <div className="co-card">
      <h1>الدفع الآمن</h1>
      {payment && <p className="co-amount">المبلغ المستحق: {money(payment.amountHalalah)}</p>}
      {error ? <p className="acc-error" role="alert">{error}</p> : !payment && <p role="status">نجهّز عملية الدفع…</p>}
      <div className="mysr-form" />
      {payment && <TamaraOption orderId={orderId} amountHalalah={payment.amountHalalah} />}
      <a className="co-back" href="/orders">طلباتي</a>
    </div>
  </main>;
}
