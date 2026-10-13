"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, Clock, MapPin, Minus, Plus, Share2, Trophy } from "lucide-react";
import { bookingErrorView, MAX_TICKETS_PER_MATCH, type BookingCreated, type BookingErrorView } from "@/lib/match-booking";
import {
  formatMatchDate, formatMatchTime, formatSectionPrice, HOME_TEAM_AR, matchShareText, matchTitle, matchUrl,
  salesOpeningLabel, type MatchDetail, type MatchSection,
} from "@/lib/matches";
import type { StoreData } from "@/lib/types";
import { StoreShell, type StoreShellApi } from "./store-shell";
import "./match-page.css";

/** Client half of /matches/[id]. The server half (metadata, JSON-LD, not-found) is app/matches/[id]/page.tsx. */
export default function MatchPage({ store, match }: { store: StoreData; match: MatchDetail }) {
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
    {(api) => <main id="main-content" className="mp-main">
      <nav className="mp-breadcrumb" aria-label="مسار التنقل"><a href="/matches">تذاكر المباريات</a><span aria-hidden="true">/</span><span aria-current="page">{matchTitle(match)}</span></nav>
      <MatchDetailView initial={match} api={api} />
      <p className="mp-back"><a href="/matches">كل المباريات <ArrowLeft size={17} /></a></p>
    </main>}
  </StoreShell>;
}

function Team({ name, logo }: { name: string; logo: string | null }) {
  return <span className="mp-team">
    {logo ? <img src={logo} alt="" width="72" height="72" /> : <span className="mp-logo-fallback" aria-hidden="true">{name.slice(0, 1)}</span>}
    <b>{name}</b>
  </span>;
}

function MatchDetailView({ initial, api }: { initial: MatchDetail; api: StoreShellApi }) {
  const [match, setMatch] = useState<MatchDetail>(initial);
  const [sections, setSections] = useState<MatchSection[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BookingErrorView | null>(null);
  const [resumeBuy, setResumeBuy] = useState(false);

  // Sales state and availability change by the minute: always read them fresh, never from the ISR page.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matches/${initial.id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled && body?.match) setMatch(body.match as MatchDetail); })
      .catch(() => { /* keep the server-rendered state */ });
    if (initial.isTicketable) {
      fetch(`/api/matches/${initial.id}/sections`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((body) => { if (!cancelled) setSections(Array.isArray(body?.sections) ? (body.sections as MatchSection[]) : []); })
        .catch(() => { if (!cancelled) setLoadFailed(true); });
    }
    return () => { cancelled = true; };
  }, [initial.id, initial.isTicketable]);

  const selected = sections?.find((section) => section.id === sectionId) ?? null;
  const maxQuantity = selected?.remaining != null
    ? Math.max(1, Math.min(MAX_TICKETS_PER_MATCH, selected.remaining))
    : MAX_TICKETS_PER_MATCH;

  const submit = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/match-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, sectionId: selected.id, quantity }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        api.session.setUser(null);
        setResumeBuy(true);
        api.openAuth();
        return;
      }
      if (!response.ok) {
        const largest = typeof body?.largestAvailable === "number" ? body.largestAvailable : null;
        setError(bookingErrorView(body?.code ?? body?.error ?? null, largest, quantity));
        return;
      }
      const created = body as BookingCreated;
      if (created.status === "CONFIRMED") {
        window.location.assign(`/checkout/tickets/result?booking=${encodeURIComponent(created.bookingId)}`);
        return;
      }
      const params = new URLSearchParams({ booking: created.bookingId, match: match.id });
      if (created.expiresAt) params.set("expires", created.expiresAt);
      window.location.assign(`/checkout/tickets/pay?${params.toString()}`);
    } catch {
      setError(bookingErrorView(null, null, quantity));
    } finally {
      setBusy(false);
    }
  }, [api, busy, match.id, quantity, selected]);

  const buy = () => {
    if (!selected) return;
    if (!api.session.user) {
      setResumeBuy(true);
      api.openAuth();
      return;
    }
    void submit();
  };

  // After signing in from the buy button, continue with the same selection.
  useEffect(() => {
    if (resumeBuy && api.session.user) {
      setResumeBuy(false);
      void submit();
    }
  }, [resumeBuy, api.session.user, submit]);

  // Native share sheet on phones; copy the link elsewhere. Never throws.
  const share = async () => {
    const url = matchUrl(match.id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: matchTitle(match), text: matchShareText(match), url });
      } catch {
        // The visitor closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      api.showToast("نسخنا رابط المباراة");
    } catch {
      api.showToast("تعذّر نسخ الرابط");
    }
  };

  const home = { name: HOME_TEAM_AR, logo: "/images/crest.svg" };
  const away = { name: match.opponent.nameAr, logo: match.opponent.logo };
  const [left, right] = match.isHome ? [home, away] : [away, home];
  const suggest = error?.suggestQuantity ?? null;
  const pricedSections = (sections ?? []).filter((section) => section.price !== null);

  let buyArea: ReactNode;
  if (!match.isTicketable) {
    buyArea = <p className="mp-note">لا تُباع تذاكر هذه المباراة عبر المتجر.</p>;
  } else if (match.salesState === "NOT_OPEN") {
    buyArea = <p className="mp-note">{match.salesOpenAt ? salesOpeningLabel(match.salesOpenAt) : "لم يبدأ البيع بعد."}</p>;
  } else if (!match.isBookable) {
    buyArea = <p className="mp-note">البيع مغلق لهذه المباراة.</p>;
  } else if (loadFailed) {
    buyArea = <p className="mp-note">تعذّر تحميل المدرجات. حدّث الصفحة.</p>;
  } else if (sections === null) {
    buyArea = <p className="mp-note" role="status">نحمّل المدرجات…</p>;
  } else if (pricedSections.length === 0) {
    buyArea = <p className="mp-note">لا توجد مدرجات متاحة للحجز الآن.</p>;
  } else {
    buyArea = <>
      <fieldset className="mp-sections">
        <legend>اختر المدرج</legend>
        {pricedSections.map((section) => {
          const disabled = section.isFull;
          return <label key={section.id} className={`mp-section${sectionId === section.id ? " selected" : ""}${disabled ? " disabled" : ""}`}>
            <input type="radio" name="section" value={section.id} checked={sectionId === section.id} disabled={disabled}
              onChange={() => { setSectionId(section.id); setQuantity(1); setError(null); }} />
            <span className="mp-section-name">{section.name}</span>
            <span className="mp-section-price">{section.isFull ? "نفدت التذاكر" : formatSectionPrice(section.price ?? 0)}</span>
          </label>;
        })}
      </fieldset>
      <div className="mp-qty">
        <span>عدد التذاكر</span>
        <div className="mp-stepper">
          <button type="button" aria-label="إنقاص" title="إنقاص" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}><Minus size={16} /></button>
          <output aria-live="polite">{quantity}</output>
          <button type="button" aria-label="زيادة" title="زيادة" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}><Plus size={16} /></button>
        </div>
      </div>
      {selected && selected.price !== null && <p className="mp-total">الإجمالي: <b>{formatSectionPrice(Math.round(selected.price * quantity * 100) / 100)}</b></p>}
      {error && <div className="mp-error" role="alert">
        <p>{error.message}</p>
        {suggest !== null && <button type="button" className="text-button" onClick={() => { setQuantity(suggest); setError(null); }}>اختر {suggest} تذاكر</button>}
      </div>}
      <button type="button" className="button button-primary mp-buy" disabled={!selected || busy || !api.session.ready} onClick={buy}>
        {busy ? "نجهّز حجزك…" : selected?.price === 0 ? "احجز مجانًا" : "اشترِ التذاكر"}
      </button>
      <p className="mp-hint">الحد الأقصى {MAX_TICKETS_PER_MATCH} تذاكر لكل مباراة. في المدرجات المرقّمة يُحجز المقعد لك 10 دقائق لإتمام الدفع.</p>
    </>;
  }

  return <section className="mp-card" aria-labelledby="mp-title">
    <div className="mp-head">
      <div className="mp-teams">
        <Team name={left.name} logo={left.logo} />
        <span className="mp-vs" aria-hidden="true">×</span>
        <Team name={right.name} logo={right.logo} />
      </div>
      <button type="button" className="mp-share" onClick={() => void share()} aria-label="مشاركة المباراة" title="مشاركة المباراة"><Share2 size={18} /> مشاركة</button>
    </div>
    <h1 id="mp-title">{matchTitle(match)}</h1>
    <ul className="mp-facts">
      <li><CalendarDays size={16} /> {formatMatchDate(match.date)}</li>
      <li><Clock size={16} /> {formatMatchTime(match.date)} بتوقيت السعودية</li>
      <li><MapPin size={16} /> {match.stadiumAr}</li>
      {match.competitionAr && <li><Trophy size={16} /> {match.competitionAr}</li>}
    </ul>
    <div className="mp-buy-area">{buyArea}</div>
  </section>;
}
