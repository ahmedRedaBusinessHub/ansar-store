"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PaymentState } from "../../../lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,255}$/;
type View = "checking" | "paid" | "failed" | "pending" | "invalid";

export default function ResultClient() {
  const params = useSearchParams();
  const paymentId = params.get("payment") ?? "";
  const orderId = params.get("order") ?? "";
  const providerId = params.get("id") ?? "";
  const providerMessage = (params.get("message") ?? "").slice(0, 200);
  const [view, setView] = useState<View>("checking");

  useEffect(() => {
    if (!UUID.test(paymentId) || !UUID.test(orderId)) { setView("invalid"); return; }
    let cancelled = false;
    const finish = (state: PaymentState["status"] | null) => {
      if (cancelled) return false;
      if (state === "PAID") {
        try { localStorage.setItem("ansar-store:cart:v2", "[]"); } catch { /* ignore */ }
        setView("paid"); return true;
      }
      if (state === "FAILED") { setView("failed"); return true; }
      return false;
    };
    (async () => {
      // The URL's status=paid is never trusted: web-api asks Moyasar and checks the metadata.
      const synced = await fetch(`/api/payments/${paymentId}/sync`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(PROVIDER_ID.test(providerId) ? { providerPaymentId: providerId } : {}),
      }).then((r) => (r.ok ? r.json() as Promise<PaymentState> : null)).catch(() => null);
      if (finish(synced?.status ?? null)) return;
      for (let attempt = 0; attempt < 10 && !cancelled; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const state = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() as Promise<PaymentState> : null)).catch(() => null);
        if (finish(state?.status ?? null)) return;
      }
      if (!cancelled) setView("pending");
    })();
    return () => { cancelled = true; };
  }, [paymentId, orderId, providerId]);

  return <main className="co-shell" dir="rtl">
    <div className="co-card" aria-live="polite">
      {view === "checking" && <><h1>نتحقق من الدفع…</h1><p>لا تغلق هذه الصفحة.</p></>}
      {view === "paid" && <><h1>تم الدفع بنجاح</h1><p>شكرًا لك! طلبك قيد التجهيز.</p><a className="acc-primary" href={`/orders?placed=${orderId}`}>عرض طلباتي</a></>}
      {view === "failed" && <><h1>لم تكتمل عملية الدفع</h1>{providerMessage && <p className="acc-note">{providerMessage}</p>}<a className="acc-primary" href={`/checkout/pay?order=${orderId}`}>حاول الدفع مجددًا</a></>}
      {view === "pending" && <><h1>ما زلنا ننتظر تأكيد الدفع</h1><p>سيظهر التحديث في صفحة طلباتي خلال دقائق. لا تكرر الدفع.</p><a className="acc-primary" href="/orders">طلباتي</a></>}
      {view === "invalid" && <><h1>رابط غير صالح</h1><a className="co-back" href="/">العودة إلى المتجر</a></>}
    </div>
  </main>;
}
