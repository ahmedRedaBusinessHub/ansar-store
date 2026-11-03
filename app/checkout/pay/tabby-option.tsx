"use client";

import { useEffect, useState } from "react";
import { loadTabbyScript } from "@/lib/tabby-script";
import { entityIdKey, tabbyInstalmentLabel, tabbyRejectionMessage } from "@/lib/tabby";
import type { InstalmentEntity } from "@/lib/tamara";

type TabbyEligibility = {
  available: boolean;
  reason: "UNAVAILABLE" | "NEEDS_EMAIL" | "REJECTED" | null;
  rejectionReason: string | null;
  instalments: number | null;
  instalmentAmountHalalah: number | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TabbyOption({ entity, amountHalalah }: { entity: InstalmentEntity; amountHalalah: number }) {
  const [eligibility, setEligibility] = useState<TabbyEligibility | null>(null);
  const [email, setEmail] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [confirmSeq, setConfirmSeq] = useState(0);
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const idKey = entityIdKey(entity);
  const entityId = entity.id;

  useEffect(() => {
    let cancelled = false;
    const queryParams: Record<string, string> = {
      [idKey]: entityId,
      amount: String(amountHalalah),
      provider: "tabby",
    };
    if (confirmedEmail) queryParams.email = confirmedEmail;
    const query = new URLSearchParams(queryParams);

    fetch(`/api/payments/instalments/eligibility?${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<TabbyEligibility>) : null))
      .then((value) => {
        if (!cancelled) setEligibility(value);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      });

    return () => {
      cancelled = true;
    };
  }, [idKey, entityId, amountHalalah, confirmedEmail, confirmSeq]);

  useEffect(() => {
    if (!eligibility?.available) return;
    let cancelled = false;

    fetch("/api/tabby-config")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (config) => {
        if (cancelled || !config || config.disabled || !config.publicKey) return;
        await loadTabbyScript("https://checkout.tabby.ai/tabby-card.js");
        if (cancelled) return;
        if (typeof (window as any).TabbyCard === "function") {
          new (window as any).TabbyCard({
            selector: "#tabby-card-slot",
            currency: "SAR",
            lang: "ar",
            price: (amountHalalah / 100).toFixed(2),
            publicKey: config.publicKey,
            merchantCode: config.merchantCode,
          });
        }
      })
      .catch(() => {
        // skip silently
      });

    return () => {
      cancelled = true;
    };
  }, [eligibility?.available, amountHalalah]);

  if (!eligibility || eligibility.reason === "UNAVAILABLE") {
    return null;
  }

  const confirmEmail = () => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("أدخل بريدًا إلكترونيًا صحيحًا");
      return;
    }
    setEmailError("");
    setEmail(trimmed);
    setConfirmedEmail(trimmed);
    setConfirmSeq((s) => s + 1);
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const buyerEmail = email.trim();
      const payload: Record<string, unknown> = {
        [idKey]: entityId,
        amount: amountHalalah,
        provider: "tabby",
        ...(buyerEmail ? { buyerEmail } : {}),
      };

      const response = await fetch("/api/payments/instalments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        code?: string;
        rejectionReason?: string;
      };

      if (response.ok && typeof body.checkoutUrl === "string") {
        window.location.assign(body.checkoutUrl);
        return;
      }

      if (response.status === 401) {
        setError("سجّل الدخول ثم حاول مجددًا.");
      } else if (response.status === 429) {
        setError("محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا.");
      } else if (body.code === "EMAIL_IN_USE") {
        setError("هذا البريد مستخدم في حساب آخر");
      } else if (body.code === "EMAIL_REQUIRED") {
        setEligibility((prev) => ({
          available: false,
          reason: "NEEDS_EMAIL",
          rejectionReason: null,
          instalments: prev?.instalments ?? null,
          instalmentAmountHalalah: prev?.instalmentAmountHalalah ?? null,
        }));
      } else if (body.code === "INSTALMENTS_REJECTED") {
        setError(tabbyRejectionMessage(body.rejectionReason));
      } else {
        setError("تعذّر فتح تابي الآن. جرّب طريقة دفع أخرى.");
      }
    } catch {
      setError("تعذّر فتح تابي الآن. جرّب طريقة دفع أخرى.");
    }
    setBusy(false);
  };

  if (eligibility.reason === "NEEDS_EMAIL") {
    return (
      <section className="co-tabby" aria-label="الدفع بالتقسيط مع تابي">
        <div className="co-divider"><span>أو</span></div>
        <label htmlFor="co-tabby-email" className="acc-note">البريد الإلكتروني (مطلوب لتابي)</label>
        <input
          id="co-tabby-email"
          type="email"
          className="co-tabby-email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmEmail();
            }
          }}
          dir="ltr"
        />
        {emailError && <p className="acc-error" role="alert">{emailError}</p>}
        <button type="button" className="co-tabby-btn" onClick={confirmEmail}>متابعة</button>
        {error && <p className="acc-note">{error}</p>}
      </section>
    );
  }

  if (eligibility.reason === "REJECTED") {
    return (
      <section className="co-tabby" aria-label="الدفع بالتقسيط مع تابي">
        <button type="button" className="co-tabby-btn" disabled>تابي</button>
        <p className="acc-note">{tabbyRejectionMessage(eligibility.rejectionReason)}</p>
        {error && <p className="acc-note">{error}</p>}
      </section>
    );
  }

  if (eligibility.available) {
    const instalmentAmount = eligibility.instalmentAmountHalalah ?? Math.round(amountHalalah / 4);
    return (
      <section className="co-tabby" aria-label="الدفع بالتقسيط مع تابي">
        <div className="co-divider"><span>أو</span></div>
        <button type="button" className="co-tabby-btn" onClick={start} disabled={busy}>
          {busy ? "نحوّلك إلى تابي…" : "ادفع مع تابي"}
        </button>
        <p className="acc-note">{tabbyInstalmentLabel(instalmentAmount)}</p>
        <div id="tabby-card-slot" />
        {error && <p className="acc-note">{error}</p>}
      </section>
    );
  }

  return null;
}
