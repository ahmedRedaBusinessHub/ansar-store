"use client";

import { useEffect, useState } from "react";
import type { InstalmentEntity } from "@/lib/tamara";

type Eligibility = { available: boolean; instalments: number | null; instalmentAmountHalalah: number | null };
const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

const ERRORS: Record<InstalmentEntity["type"], Record<string, string>> = {
  ORDER: {
    AMOUNT_MISMATCH: "تغيّر مبلغ الطلب. حدّث الصفحة ثم حاول مجددًا.",
    ENTITY_NOT_AWAITING_PAYMENT: "هذا الطلب مدفوع أو لم يعد قابلًا للدفع.",
    INSTALMENTS_AMOUNT_OUT_OF_RANGE: "مبلغ الطلب خارج حدود التقسيط مع تمارا.",
  },
  SEASON_PASS: {
    AMOUNT_MISMATCH: "تغيّر سعر التذكرة. حدّث الصفحة ثم حاول مجددًا.",
    ENTITY_NOT_AWAITING_PAYMENT: "هذه التذكرة مدفوعة أو انتهت مهلة حجزها.",
    INSTALMENTS_AMOUNT_OUT_OF_RANGE: "سعر التذكرة خارج حدود التقسيط مع تمارا.",
  },
  EVENT: {
    AMOUNT_MISMATCH: "تغيّر سعر الحجز. حدّث الصفحة ثم حاول مجددًا.",
    ENTITY_NOT_AWAITING_PAYMENT: "هذا الحجز مدفوع أو انتهت مهلته.",
    INSTALMENTS_AMOUNT_OUT_OF_RANGE: "مبلغ الحجز خارج حدود التقسيط مع تمارا.",
    EVENT_FULLY_BOOKED: "اكتمل الحجز لهذه الفعالية.",
    INSUFFICIENT_SLOTS: "لم يعد هناك مكان كافٍ لهذا الحجز.",
  },
};
const SIGN_IN: Record<InstalmentEntity["type"], string> = {
  ORDER: "سجّل الدخول من صفحة المتجر ثم عد لإكمال الدفع.",
  SEASON_PASS: "سجّل الدخول من صفحة التذكرة الموسمية ثم عد لإكمال الدفع.",
  EVENT: "سجّل الدخول من صفحة الفعالية ثم عد لإكمال الدفع.",
};

/** Tamara instalments for a store order, season pass, or event booking: shown only when web-api says it is eligible. Redirects to Tamara's hosted checkout. */
export default function TamaraOption({ entity, amountHalalah }: { entity: InstalmentEntity; amountHalalah: number }) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idKey = entity.type === "ORDER" ? "orderId" : entity.type === "SEASON_PASS" ? "passId" : "subscriptionId";
  const entityId = entity.id;
  const entityType = entity.type;

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ [idKey]: entityId, amount: String(amountHalalah) });
    fetch(`/api/payments/instalments/eligibility?${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() as Promise<Eligibility> : null))
      .then((value) => { if (!cancelled) setEligibility(value); })
      .catch(() => { if (!cancelled) setEligibility(null); });
    return () => { cancelled = true; };
  }, [idKey, entityId, amountHalalah]);

  if (!eligibility?.available || !eligibility.instalments || !eligibility.instalmentAmountHalalah) return null;

  const start = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/payments/instalments/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [idKey]: entityId, amount: amountHalalah }),
      });
      const body = await response.json().catch(() => ({})) as { checkoutUrl?: string; code?: string };
      if (response.ok && typeof body.checkoutUrl === "string") { window.location.assign(body.checkoutUrl); return; }
      if (response.status === 401) setError(SIGN_IN[entityType]);
      else if (response.status === 429) setError("محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا.");
      else setError((body.code && ERRORS[entityType][body.code]) || "تعذّر فتح تمارا الآن. جرّب طريقة دفع أخرى.");
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
