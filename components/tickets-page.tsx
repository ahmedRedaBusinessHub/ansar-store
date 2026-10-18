"use client";

import { useEffect, useState } from "react";
import { eventDateLabel, isPastEvent, type MyEventBookingView } from "@/lib/events";
import { eventPayHref } from "@/lib/event-booking";
import { formatMatchDate, formatMatchTime } from "@/lib/matches";
import type { MySeasonPassView } from "@/lib/season-pass";
import type { TicketBookingView } from "@/lib/tickets";
import { EventCancel } from "./event-cancel";
import { EventTicketCard } from "./event-ticket-card";
import { SeasonPassCard, SeasonPassPendingCard } from "./season-pass-card";
import type { StoreData } from "@/lib/types";
import { StoreShell, type StoreShellApi } from "./store-shell";
import { bookingTitle, TicketCard } from "./ticket-card";
import "./ticket-card.css";

/** Client half of /tickets. */
export default function TicketsPage({ store }: { store: StoreData }) {
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
    {(api) => <main id="main-content" className="tk-page section-shell">
      <h1>تذاكري<span className="heading-dot">.</span></h1>
      <MySeasonPasses api={api} />
      <MyEvents api={api} />
      <MyTickets api={api} />
    </main>}
  </StoreShell>;
}

/** The signed-in shopper's season passes. Renders nothing when there are none (or they cannot be loaded). */
function MySeasonPasses({ api }: { api: StoreShellApi }) {
  const [passes, setPasses] = useState<MySeasonPassView[] | null>(null);
  const userId = api.session.user?.id ?? null;

  useEffect(() => {
    if (!userId) { setPasses(null); return; }
    let cancelled = false;
    fetch("/api/season-passes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled) setPasses(Array.isArray(body?.passes) ? (body.passes as MySeasonPassView[]) : []); })
      .catch(() => { if (!cancelled) setPasses([]); });
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId || !passes || passes.length === 0) return null;
  return <section id="season-passes" className="sp-section" aria-labelledby="sp-section-title">
    <h2 id="sp-section-title">تذاكري الموسمية</h2>
    <div className="tk-stack">
      {passes.map((pass) => pass.status === "ACTIVE"
        ? <SeasonPassCard key={pass.id} pass={pass} />
        : <SeasonPassPendingCard key={pass.id} pass={pass} />)}
    </div>
  </section>;
}

/** The signed-in shopper's event bookings. Renders nothing when there are none (or they cannot be loaded). */
function MyEvents({ api }: { api: StoreShellApi }) {
  const [bookings, setBookings] = useState<MyEventBookingView[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [version, setVersion] = useState(0);
  const userId = api.session.user?.id ?? null;

  useEffect(() => {
    if (!userId) { setBookings(null); return; }
    let cancelled = false;
    fetch("/api/event-tickets", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled) setBookings(Array.isArray(body?.bookings) ? (body.bookings as MyEventBookingView[]) : []); })
      .catch(() => { if (!cancelled) setBookings([]); });
    return () => { cancelled = true; };
  }, [userId, version]);

  if (!userId || !bookings || bookings.length === 0) return null;
  const upcoming = bookings.filter((b) => !isPastEvent(b.event.date));
  const past = bookings.filter((b) => isPastEvent(b.event.date) && b.status === "CONFIRMED");
  const reload = () => setVersion((v) => v + 1);

  return <section id="events" className="sp-section" aria-labelledby="ev-section-title">
    <h2 id="ev-section-title">فعالياتي</h2>
    <div className="tk-stack">
      {upcoming.map((booking) => booking.status === "PENDING_PAYMENT"
        ? <article key={booking.id} className="tk-card tk-pending">
            <header className="tk-head">
              <h2>{booking.event.titleAr}</h2>
              <p>{eventDateLabel(booking.event.date)}</p>
              <p>بانتظار الدفع · عدد التذاكر {booking.quantity}</p>
            </header>
            {/* The intent re-arms the hold, or reports the event full (web-events 2026-10-14). */}
            <a className="button button-primary" href={eventPayHref(booking.id, booking.event.id, null)}>أكمل الدفع</a>
          </article>
        : <EventTicketCard key={booking.id} booking={booking} footer={<EventCancel subscriptionId={booking.id} onDone={reload} />} />)}
      {past.length > 0 && <>
        <button type="button" className="text-button" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
          {showPast ? "إخفاء الفعاليات السابقة" : `الفعاليات السابقة (${past.length})`}
        </button>
        {showPast && past.map((booking) => <EventTicketCard key={booking.id} booking={booking} />)}
      </>}
    </div>
  </section>;
}

function MyTickets({ api }: { api: StoreShellApi }) {
  const [bookings, setBookings] = useState<TicketBookingView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const userId = api.session.user?.id ?? null;

  useEffect(() => {
    if (!userId) { setBookings(null); return; }
    let cancelled = false;
    setFailed(false);
    fetch("/api/tickets", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setBookings(Array.isArray(body?.bookings) ? (body.bookings as TicketBookingView[]) : []); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  if (!api.session.ready) return <p role="status">لحظة…</p>;
  if (!api.session.user) {
    return <div className="tk-empty">
      <p>سجّل الدخول برقم جوالك لعرض تذاكرك.</p>
      <button type="button" className="button button-primary" onClick={api.openAuth}>تسجيل الدخول</button>
    </div>;
  }
  if (failed) return <p className="tk-error" role="alert">تعذّر تحميل تذاكرك. حدّث الصفحة.</p>;
  if (bookings === null) return <p role="status">نحمّل تذاكرك…</p>;
  if (bookings.length === 0) {
    return <div className="tk-empty">
      <p>لا توجد تذاكر بعد.</p>
      <a className="button button-primary" href="/matches">تذاكر المباريات</a>
      <a className="button" href="/events">الفعاليات</a>
    </div>;
  }
  return <div className="tk-stack">
    {bookings.map((booking) => booking.status === "PENDING_PAYMENT"
      ? <article key={booking.id} className="tk-card tk-pending">
          <header className="tk-head">
            <h2>{bookingTitle(booking)}</h2>
            <p>{formatMatchDate(booking.date)} · {formatMatchTime(booking.date)}</p>
            <p>بانتظار الدفع · عدد التذاكر {booking.quantity}</p>
          </header>
          <a className="button button-primary" href={`/checkout/tickets/pay?booking=${encodeURIComponent(booking.id)}&match=${encodeURIComponent(booking.matchId)}`}>أكمل الدفع</a>
        </article>
      : <TicketCard key={booking.id} booking={booking} />)}
  </div>;
}
