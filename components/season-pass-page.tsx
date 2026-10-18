"use client";

import { useCallback, useEffect, useState } from "react";
import { Armchair, CalendarDays, Minus, Plus, Ticket } from "lucide-react";
import { formatSectionPrice } from "@/lib/matches";
import {
  maxPassQuantity, passErrorView, passPayHref, type PassCreated, type SeasonPassOffer, type SeasonTier,
} from "@/lib/season-pass";
import type { SeatConfirmResult } from "@/lib/seat-map";
import type { StoreData } from "@/lib/types";
import { SeasonSeatPicker } from "./season-seat-picker";
import { StoreShell, type StoreShellApi } from "./store-shell";
import "./season-pass-page.css";

/** Client half of /season-pass. The server half (metadata) is app/season-pass/page.tsx. */
export default function SeasonPassPage({ store }: { store: StoreData }) {
  const [query, setQuery] = useState("");
  return <StoreShell
    store={store}
    nav={{
      onShopAll: () => window.location.assign("/#collection"),
      onFavorites: () => window.location.assign("/?favorites=1#collection"),
      storyHref: "/#our-story",
      isShopAllActive: false,
    }}
    search={{
      query,
      onQueryChange: setQuery,
      onSubmit: () => window.location.assign(`/?q=${encodeURIComponent(query.trim())}#collection`),
    }}
  >
    {(api) => <main id="main-content" className="spp-page section-shell">
      <span className="section-kicker">موسم الأنصار</span>
      <h1>التذكرة الموسمية<span className="heading-dot">.</span></h1>
      <HowItWorks />
      <SeasonPassOfferView api={api} />
    </main>}
  </StoreShell>;
}

const STEPS = [
  { title: "موسم كامل، بتذكرة واحدة", body: "اختر تذكرة موسمية بدل حجز تذكرة مستقلة لكل مباراة مشمولة بفئتك." },
  { title: "شجّعنا على أرضنا", body: "التذكرة تشمل مباريات الفريق الأول المشمولة بفئتك على ملعب الأنصار. المباريات خارج أرضنا غير مشمولة." },
  { title: "اختر فئتك واستعد للدخول", body: "راجع تفاصيل الفئة، واختر مقعدك إذا كانت الفئة بمقاعد محددة. بعد الدفع تجد تذكرتك ورمز الدخول في «تذاكري»." },
];

function HowItWorks() {
  return <section className="spp-how" aria-labelledby="spp-how-title">
    <h2 id="spp-how-title">كيف تعمل التذكرة الموسمية</h2>
    <ol>
      {STEPS.map((step, index) => <li key={step.title}>
        <span className="spp-step" aria-hidden="true">{index + 1}</span>
        <div><b>{step.title}</b><p>{step.body}</p></div>
      </li>)}
    </ol>
  </section>;
}

/** What to continue after the sign-in dialog: buy an OPEN tier, or open the seat map of a SEAT tier. */
type Pending = { tierId: string; action: "buy" | "pick"; quantity: number };

function SeasonPassOfferView({ api }: { api: StoreShellApi }) {
  const [offer, setOffer] = useState<SeasonPassOffer | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [tierId, setTierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  // Prices and places left change by the minute: always read them fresh.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/season-pass", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setOffer((body?.offer ?? null) as SeasonPassOffer | null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const tier = offer?.tiers.find((candidate) => candidate.id === tierId) ?? null;

  /** POST /api/season-passes. Never retried automatically (a retry could create a second pass). */
  const buy = useCallback(async (target: SeasonTier, count: number, seatIds?: string[]): Promise<SeatConfirmResult> => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/season-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: target.id, quantity: count, ...(seatIds ? { seatIds } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 201) {
        const created = body as PassCreated;
        window.location.assign(created.status === "ACTIVE"
          ? `/checkout/tickets/result?pass=${encodeURIComponent(created.passId)}`
          : passPayHref(created.passId, created.expiresAt));
        return { kind: "done" };
      }
      if (response.status === 401) {
        api.session.setUser(null);
        setPicking(false);
        setPending({ tierId: target.id, action: target.mode === "SEAT" ? "pick" : "buy", quantity: count });
        api.openAuth();
        return { kind: "error", message: passErrorView("unauthenticated").message };
      }
      if (response.status === 409 && body?.code === "SEASON_SEAT_CONFLICT") {
        return { kind: "conflict", takenSeatIds: Array.isArray(body.takenSeatIds) ? (body.takenSeatIds as string[]) : [] };
      }
      return { kind: "error", message: passErrorView(body?.code ?? body?.error ?? null).message };
    } catch {
      return { kind: "error", message: passErrorView(null).message };
    } finally {
      setBusy(false);
    }
  }, [api]);

  const buyOpen = async () => {
    if (!tier || busy) return;
    if (!api.session.user) {
      setPending({ tierId: tier.id, action: "buy", quantity });
      api.openAuth();
      return;
    }
    const result = await buy(tier, quantity);
    if (result.kind === "error") setMessage(result.message);
  };

  const openSeats = () => {
    if (!tier) return;
    if (!api.session.user) {
      setPending({ tierId: tier.id, action: "pick", quantity: 1 });
      api.openAuth();
      return;
    }
    setPicking(true);
  };

  // After signing in, continue where the buyer left off.
  useEffect(() => {
    if (!pending || !api.session.user || !offer) return;
    const target = offer.tiers.find((candidate) => candidate.id === pending.tierId);
    setPending(null);
    if (!target) return;
    setTierId(target.id);
    if (pending.action === "pick") { setPicking(true); return; }
    void buy(target, pending.quantity).then((result) => { if (result.kind === "error") setMessage(result.message); });
  }, [pending, api.session.user, offer, buy]);

  if (failed) return <p className="spp-note" role="alert">تعذّر تحميل الفئات. حدّث الصفحة.</p>;
  if (offer === undefined) return <p className="spp-note" role="status">نحمّل الفئات…</p>;
  if (offer === null || offer.tiers.length === 0) {
    return <div className="spp-empty">
      <h2>لا توجد تذاكر موسمية متاحة الآن</h2>
      <p>نعلن عنها فور فتح البيع.</p>
      <a className="button button-primary" href="/matches">تذاكر المباريات</a>
    </div>;
  }

  return <section className="spp-offer" aria-labelledby="spp-offer-title">
    <h2 id="spp-offer-title">فئات موسم {offer.season.year}</h2>
    <div className="spp-grid">
      {offer.tiers.map((candidate) => <TierCard key={candidate.id} tier={candidate} selected={candidate.id === tierId}
        onSelect={() => { setTierId(candidate.id); setQuantity(1); setPicking(false); setMessage(""); }} />)}
    </div>
    {tier && <div className="spp-panel" aria-live="polite">
      <h3>{tier.name}</h3>
      {tier.mode === "SEAT"
        ? picking
          ? <SeasonSeatPicker key={tier.id} tier={tier} onConfirm={(seatIds) => buy(tier, seatIds.length, seatIds)} onClose={() => setPicking(false)} />
          : <>
              <p className="spp-note">هذه الفئة بمقاعد محددة. اختر مقعدك من خريطة الملعب.</p>
              <button type="button" className="button button-primary" onClick={openSeats} disabled={!api.session.ready}>اختر مقعدك</button>
            </>
        : <OpenTierBuy tier={tier} quantity={quantity} onQuantity={setQuantity} busy={busy} ready={api.session.ready} onBuy={() => void buyOpen()} />}
      {message && <p className="spp-error" role="alert">{message}</p>}
    </div>}
  </section>;
}

function TierCard({ tier, selected, onSelect }: { tier: SeasonTier; selected: boolean; onSelect: () => void }) {
  return <article className={`spp-tier${selected ? " is-selected" : ""}${tier.isFull ? " is-full" : ""}`}>
    <header>
      <h3>{tier.name}</h3>
      <p className="spp-price">{formatSectionPrice(tier.price)}</p>
    </header>
    <ul className="spp-facts">
      <li><CalendarDays size={15} /> {tier.homeMatchesCount ? `يشمل ${tier.homeMatchesCount} مباراة على أرضنا` : "يشمل مباريات الفريق الأول على أرضنا المشمولة بالفئة"}</li>
      <li>{tier.mode === "SEAT" ? <><Armchair size={15} /> مقعد محدد لك طوال الموسم</> : <><Ticket size={15} /> دخول بدون مقعد محدد</>}</li>
      {tier.remaining !== null && !tier.isFull && <li>متبقٍ {tier.remaining}</li>}
    </ul>
    {tier.description && <p className="spp-desc">{tier.description}</p>}
    {tier.benefits.length > 0 && <dl className="spp-benefits">
      {tier.benefits.map((benefit, index) => <div key={index}><dt>{benefit.label}</dt><dd>{benefit.value}</dd></div>)}
    </dl>}
    <button type="button" className={`button ${selected ? "button-primary" : "button-outline"}`} onClick={onSelect} disabled={tier.isFull} aria-pressed={selected}>
      {tier.isFull ? "نفدت" : selected ? "تم الاختيار" : "اختر هذه الفئة"}
    </button>
  </article>;
}

function OpenTierBuy({ tier, quantity, onQuantity, busy, ready, onBuy }: {
  tier: SeasonTier; quantity: number; onQuantity: (value: number) => void; busy: boolean; ready: boolean; onBuy: () => void;
}) {
  const max = maxPassQuantity(tier);
  return <>
    {tier.price === 0
      ? <div className="spp-qty">
          <span>عدد التذاكر</span>
          <div className="spp-stepper">
            <button type="button" aria-label="إنقاص" title="إنقاص" onClick={() => onQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}><Minus size={16} /></button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" aria-label="زيادة" title="زيادة" onClick={() => onQuantity(Math.min(max, quantity + 1))} disabled={quantity >= max}><Plus size={16} /></button>
          </div>
        </div>
      : <p className="spp-note">تذكرة واحدة لكل عملية شراء.</p>}
    <p className="spp-total">الإجمالي: <b>{formatSectionPrice(Math.round(tier.price * quantity * 100) / 100)}</b></p>
    <button type="button" className="button button-primary spp-buy" disabled={busy || !ready} onClick={onBuy}>
      {busy ? "نجهّز حجزك…" : tier.price === 0 ? "احجز مجانًا" : "اشترِ التذكرة"}
    </button>
  </>;
}
