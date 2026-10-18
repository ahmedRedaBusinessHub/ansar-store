"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TamaraOption from "../../pay/tamara-option";
import { loadMoyasar } from "@/lib/moyasar-loader";
import { moyasarMethodConfig, readMethodFlags } from "@/lib/payment-methods";
import type { PendingPayment } from "@/lib/pending-payment";
import { formatClock, holdSecondsLeft, parseTicketCheckoutParams, type TicketCheckoutTarget } from "@/lib/season-pass";

const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

type Copy = {
  title: string;
  intentUrl: string;
  /** Query identifying the entity on the result page, e.g. `booking={id}`. */
  resultQuery: string;
  backHref: string;
  backLabel: string;
  signIn: string;
  restart: string;
  timer: string;
  expired: string;
};

function copyFor(target: TicketCheckoutTarget): Copy {
  if (target.kind === "event" || target.kind === "event-add") {
    const backHref = target.eventId ? `/events/${target.eventId}` : "/events";
    return {
      title: target.kind === "event" ? "دفع حجز الفعالية" : "دفع التذاكر الإضافية",
      intentUrl: target.kind === "event"
        ? `/api/event-bookings/${target.subscriptionId}/intent`
        : `/api/event-bookings/${target.subscriptionId}/add-payments/${target.paymentId}`,
      resultQuery: target.kind === "event"
        ? `event=${target.subscriptionId}`
        : `event=${target.subscriptionId}&add=${target.paymentId}`,
      backHref,
      backLabel: "العودة إلى الفعالية",
      signIn: "سجّل الدخول من صفحة الفعالية ثم أعد المحاولة.",
      restart: "انتهت مهلة هذا الحجز أو تم دفعه. ابدأ من جديد من صفحة الفعالية.",
      timer: "مقاعدك محجوزة لك لمدة",
      expired: "انتهت مهلة الحجز. ارجع إلى «تذاكري» واضغط «أكمل الدفع» إن بقيت أماكن.",
    };
  }
  if (target.kind === "pass") {
    return {
      title: "دفع التذكرة الموسمية",
      intentUrl: `/api/season-passes/${target.passId}/intent`,
      resultQuery: `pass=${target.passId}`,
      backHref: "/season-pass",
      backLabel: "العودة إلى التذكرة الموسمية",
      signIn: "سجّل الدخول من صفحة التذكرة الموسمية ثم أعد المحاولة.",
      restart: "انتهت مهلة هذا الحجز أو تم دفعه. ابدأ من جديد من صفحة التذكرة الموسمية.",
      timer: "مقعدك محجوز لك لمدة",
      expired: "انتهت مهلة الحجز. ابدأ من جديد من صفحة التذكرة الموسمية.",
    };
  }
  return {
    title: "دفع التذاكر",
    intentUrl: `/api/match-bookings/${target.bookingId}/intent`,
    resultQuery: `booking=${target.bookingId}`,
    backHref: target.matchId ? `/matches/${target.matchId}` : "/matches",
    backLabel: "العودة إلى المباراة",
    signIn: "سجّل الدخول من صفحة المباراة ثم أعد المحاولة.",
    restart: "انتهت مهلة هذا الحجز أو تم دفعه. ابدأ من جديد من صفحة المباراة.",
    timer: "مقاعدك محجوزة لك لمدة",
    expired: "انتهت مهلة الحجز. ابدأ من جديد من صفحة المباراة.",
  };
}

/** Unified pay page for tickets: `?booking=` (match tickets), `?pass=` (season pass), or `?event=` (event booking). Store orders use /checkout/pay. */
export default function TicketPayClient() {
  const params = useSearchParams();
  const target = parseTicketCheckoutParams(params);
  if (!target) {
    return <main className="co-shell" dir="rtl">
      <div className="co-card">
        <h1>دفع التذاكر</h1>
        <p className="acc-error" role="alert">رابط الدفع غير صالح.</p>
        <a className="co-back" href="/matches">تذاكر المباريات</a>
      </div>
    </main>;
  }
  return <TicketPayment target={target} expires={params.get("expires")} />;
}

function TicketPayment({ target, expires }: { target: TicketCheckoutTarget; expires: string | null }) {
  const copy = copyFor(target);
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState<number | null>(() => holdSecondsLeft(expires));
  const expired = left === 0;

  useEffect(() => {
    if (holdSecondsLeft(expires) === null) return;
    const timer = setInterval(() => setLeft(holdSecondsLeft(expires)), 1000);
    return () => clearInterval(timer);
  }, [expires]);

  useEffect(() => {
    fetch(copy.intentUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) { setError(copy.signIn); return; }
        if (body?.code === "EVENT_FULLY_BOOKED" || body?.code === "INSUFFICIENT_SLOTS") { setError("اكتمل الحجز لهذه الفعالية ولم يعد بالإمكان الدفع."); return; }
        if (response.status === 404 || body?.code === "INVALID_STATUS") { setError(copy.restart); return; }
        if (!response.ok) { setError("تعذّر تجهيز الدفع الآن. حاول بعد قليل."); return; }
        setPayment(body as PendingPayment);
      })
      .catch(() => setError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا."));
  }, [copy.intentUrl, copy.signIn, copy.restart]);

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
        callback_url: `${site}/checkout/tickets/result?payment=${payment.paymentId}&${copy.resultQuery}`,
        ...methodConfig,
        language: "ar",
        metadata: payment.metadata,
      });
    }).catch(() => setError("تعذّر تحميل نموذج الدفع. حاول مجددًا."));
  }, [payment, expired, copy.resultQuery]);

  return <main className="co-shell" dir="rtl">
    <div className="co-card">
      <h1>{copy.title}</h1>
      {left !== null && !expired && <p className="co-timer" role="timer">{copy.timer} <b dir="ltr">{formatClock(left)}</b></p>}
      {expired
        ? <p className="acc-error" role="alert">{copy.expired}</p>
        : <>
            {payment && <p className="co-amount">المبلغ المستحق: {money(payment.amountHalalah)}</p>}
            {error ? <p className="acc-error" role="alert">{error}</p> : !payment && <p role="status">نجهّز عملية الدفع…</p>}
            <div className="mysr-form" />
            {target.kind === "pass" && payment && <TamaraOption entity={{ type: "SEASON_PASS", id: target.passId }} amountHalalah={payment.amountHalalah} />}
            {target.kind === "event" && payment && <TamaraOption entity={{ type: "EVENT", id: target.subscriptionId }} amountHalalah={payment.amountHalalah} />}
          </>}
      <a className="co-back" href={copy.backHref}>{copy.backLabel}</a>
    </div>
  </main>;
}
