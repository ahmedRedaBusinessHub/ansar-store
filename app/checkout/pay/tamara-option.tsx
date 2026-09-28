"use client";

import { useEffect, useState } from "react";

type Eligibility = { available: boolean; instalments: number | null; instalmentAmountHalalah: number | null };
const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

const ERRORS: Record<string, string> = {
  AMOUNT_MISMATCH: "تغيّر مبلغ الطلب. حدّث الصفحة ثم حاول مجددًا.",
  ENTITY_NOT_AWAITING_PAYMENT: "هذا الطلب مدفوع أو لم يعد قابلًا للدفع.",
  INSTALMENTS_AMOUNT_OUT_OF_RANGE: "مبلغ الطلب خارج حدود التقسيط مع تمارا.",
};

/** Tamara instalments: shown only when web-api says this order is eligible. Redirects to Tamara's hosted checkout. */
export default function TamaraOption({ orderId, amountHalalah }: { orderId: string; amountHalalah: number }) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ orderId, amount: String(amountHalalah) });
    fetch(`/api/payments/instalments/eligibility?${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() as Promise<Eligibility> : null))
      .then((value) => { if (!cancelled) setEligibility(value); })
      .catch(() => { if (!cancelled) setEligibility(null); });
    return () => { cancelled = true; };
  }, [orderId, amountHalalah]);

  if (!eligibility?.available || !eligibility.instalments || !eligibility.instalmentAmountHalalah) return null;

  const start = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/payments/instalments/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, amount: amountHalalah }),
      });
      const body = await response.json().catch(() => ({})) as { checkoutUrl?: string; code?: string };
      if (response.ok && typeof body.checkoutUrl === "string") { window.location.assign(body.checkoutUrl); return; }
      if (response.status === 401) setError("سجّل الدخول من صفحة المتجر ثم عد لإكمال الدفع.");
      else if (response.status === 429) setError("محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا.");
      else setError((body.code && ERRORS[body.code]) || "تعذّر فتح تمارا الآن. جرّب طريقة دفع أخرى.");
    } catch {
      setError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا.");
    }
    setBusy(false);
  };

  return <section className="co-tamara" aria-label="الدفع بالتقسيط">
    <div className="co-divider"><span>أو</span></div>
    <button type="button" className="co-tamara-btn" onClick={start} disabled={busy}>
      {busy ? "نحوّلك إلى تمارا…" : `قسّمها على ${eligibility.instalments} دفعات مع تمارا`}
    </button>
    <p className="acc-note">{`${eligibility.instalments} دفعات بقيمة ${money(eligibility.instalmentAmountHalalah)} تقريبًا، بدون فوائد.`}</p>
    {error && <p className="acc-error" role="alert">{error}</p>}
  </section>;
}
