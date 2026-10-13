"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadMoyasar } from "@/lib/moyasar-loader";
import { moyasarMethodConfig, readMethodFlags } from "@/lib/payment-methods";
import type { PendingPayment } from "@/lib/pending-payment";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

/** Whole seconds until `expires`, or null when there is no (valid) deadline: GENERAL bookings have no hold. */
function secondsLeft(expires: string | null): number | null {
  if (!expires) return null;
  const deadline = Date.parse(expires);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function TicketPayClient() {
  const params = useSearchParams();
  const bookingId = params.get("booking") ?? "";
  const matchId = params.get("match") ?? "";
  const expires = params.get("expires");
  const backHref = UUID.test(matchId) ? `/matches/${matchId}` : "/matches";
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState<number | null>(() => secondsLeft(expires));
  const expired = left === 0;

  useEffect(() => {
    if (secondsLeft(expires) === null) return;
    const timer = setInterval(() => setLeft(secondsLeft(expires)), 1000);
    return () => clearInterval(timer);
  }, [expires]);

  useEffect(() => {
    if (!UUID.test(bookingId)) { setError("رابط الدفع غير صالح."); return; }
    fetch(`/api/match-bookings/${bookingId}/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) { setError("سجّل الدخول من صفحة المباراة ثم أعد المحاولة."); return; }
        if (response.status === 404 || body?.code === "INVALID_STATUS") { setError("انتهت مهلة هذا الحجز أو تم دفعه. ابدأ من جديد من صفحة المباراة."); return; }
        if (!response.ok) { setError("تعذّر تجهيز الدفع الآن. حاول بعد قليل."); return; }
        setPayment(body as PendingPayment);
      })
      .catch(() => setError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا."));
  }, [bookingId]);

  useEffect(() => {
    if (!payment || expired) return;
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
        callback_url: `${site}/checkout/tickets/result?payment=${payment.paymentId}&booking=${bookingId}`,
        ...methodConfig,
        language: "ar",
        metadata: payment.metadata,
      });
    }).catch(() => setError("تعذّر تحميل نموذج الدفع. حاول مجددًا."));
  }, [payment, bookingId, expired]);

  return <main className="co-shell" dir="rtl">
    <div className="co-card">
      <h1>دفع التذاكر</h1>
      {left !== null && !expired && <p className="co-timer" role="timer">مقاعدك محجوزة لك لمدة <b dir="ltr">{clock(left)}</b></p>}
      {expired
        ? <p className="acc-error" role="alert">انتهت مهلة الحجز. ابدأ من جديد من صفحة المباراة.</p>
        : <>
            {payment && <p className="co-amount">المبلغ المستحق: {money(payment.amountHalalah)}</p>}
            {error ? <p className="acc-error" role="alert">{error}</p> : !payment && <p role="status">نجهّز عملية الدفع…</p>}
            <div className="mysr-form" />
          </>}
      <a className="co-back" href={backHref}>العودة إلى المباراة</a>
    </div>
  </main>;
}
