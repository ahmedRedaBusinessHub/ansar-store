"use client";

import { useEffect, useState } from "react";
import { formatMatchDate, formatMatchTime } from "@/lib/matches";
import type { TicketBookingView } from "@/lib/tickets";
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
      <MyTickets api={api} />
    </main>}
  </StoreShell>;
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
