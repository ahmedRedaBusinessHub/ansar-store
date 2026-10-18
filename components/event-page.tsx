"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Minus, Plus } from "lucide-react";
import {
  eventDateLabel, eventPriceLabel, isPastEvent, maxEventQuantity, type EventBookingInfo,
} from "@/lib/events";
import {
  eventAddPayHref, eventBookingErrorView, eventPayHref, notBookableLabel, type EventBookingErrorView,
} from "@/lib/event-booking";
import type { StoreData } from "@/lib/types";
import { EventCancel } from "./event-cancel";
import { StoreShell, type StoreShellApi } from "./store-shell";
import "./events.css";

/** Client half of /events/[id]. The server half (metadata, JSON-LD, not-found) is app/events/[id]/page.tsx. */
export default function EventPage({ store, initial }: { store: StoreData; initial: EventBookingInfo }) {
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
    {(api) => <main id="main-content" className="section-shell ev-page">
      <nav className="ev-breadcrumb" aria-label="مسار التنقل"><a href="/events">الفعاليات</a><span aria-hidden="true">/</span><span aria-current="page">{initial.event.titleAr}</span></nav>
      <EventDetailView initial={initial} api={api} />
      <p className="ev-back"><a href="/events">كل الفعاليات <ArrowLeft size={17} /></a></p>
    </main>}
  </StoreShell>;
}

function EventDetailView({ initial, api }: { initial: EventBookingInfo; api: StoreShellApi }) {
  const [info, setInfo] = useState<EventBookingInfo>(initial);
  const [quantity, setQuantity] = useState(1);
  const [addQuantity, setAddQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EventBookingErrorView | null>(null);
  const [resumeBuy, setResumeBuy] = useState(false);
  const userId = api.session.user?.id ?? null;
  const event = info.event;

  // Availability and "my booking" change by the minute (and with the session): always read them fresh.
  const refresh = useCallback(() => {
    fetch(`/api/events/${initial.event.id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (body?.info) setInfo(body.info as EventBookingInfo); })
      .catch(() => { /* keep the last known state */ });
  }, [initial.event.id]);
  useEffect(() => { refresh(); }, [refresh, userId]);

  const max = maxEventQuantity(info);
  useEffect(() => { setQuantity((q) => Math.min(q, max)); }, [max]);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/event-bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, quantity }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) { api.session.setUser(null); setResumeBuy(true); api.openAuth(); return; }
      if (!response.ok) {
        const view = eventBookingErrorView(body?.code ?? body?.error ?? null, typeof body?.available === "number" ? body.available : null, event.externalUrl);
        if (view.clampTo !== null) setQuantity(view.clampTo);
        setError(view);
        refresh();
        return;
      }
      if (body.status === "CONFIRMED") {
        window.location.assign(`/checkout/tickets/result?event=${encodeURIComponent(body.subscriptionId)}`);
        return;
      }
      window.location.assign(eventPayHref(body.subscriptionId, event.id, body.holdExpiresAt ?? null));
    } catch {
      setError(eventBookingErrorView(null, null, null));
    } finally {
      setBusy(false);
    }
  }, [api, busy, event.externalUrl, event.id, quantity, refresh]);

  const book = () => {
    if (!api.session.user) { setResumeBuy(true); api.openAuth(); return; }
    void submit();
  };
  useEffect(() => {
    if (resumeBuy && api.session.user) { setResumeBuy(false); void submit(); }
  }, [resumeBuy, api.session.user, submit]);

  const addTickets = async (subscriptionId: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/event-bookings/${subscriptionId}/add-tickets`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: addQuantity }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(eventBookingErrorView(body?.code ?? body?.error ?? null, typeof body?.available === "number" ? body.available : null, null)); refresh(); return; }
      if (body.requiresPayment) { window.location.assign(eventAddPayHref(subscriptionId, body.paymentId, event.id)); return; }
      api.showToast("أضفنا التذاكر إلى حجزك");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const mine = info.myBooking;
  return <article className="ev-detail">
    {event.image && <img className="ev-hero" src={event.image} alt="" />}
    <h1>{event.titleAr}</h1>
    <p className="ev-when"><CalendarDays size={16} /> {eventDateLabel(event.date)}</p>
    <p className="ev-price">{eventPriceLabel(event.price)}{event.availability && !event.externalUrl && <span className="ev-badge">{event.availability.full ? "مكتمل" : `متبقٍ ${event.availability.available}`}</span>}</p>
    {event.descriptionAr && <p className="ev-description">{event.descriptionAr}</p>}

    <section className="ev-book" aria-label="الحجز">
      {info.reason === "EXTERNAL" && event.externalUrl
        ? <a className="button button-primary" href={event.externalUrl} target="_blank" rel="noopener noreferrer">احجز من موقع المنظّم</a>
        : mine?.status === "CONFIRMED"
          ? <>
              <p>لديك حجز مؤكد · عدد التذاكر {mine.quantity}</p>
              <a className="button button-primary" href="/tickets#events">تذاكري</a>
              {!isPastEvent(event.date) && <div className="ev-add">
                <Stepper value={addQuantity} max={maxEventQuantity({ ...info, myBooking: null })} onChange={setAddQuantity} label="عدد التذاكر الإضافية" />
                <button type="button" className="button" disabled={busy || event.availability?.full} onClick={() => void addTickets(mine.id)}>إضافة تذاكر</button>
              </div>}
              <EventCancel subscriptionId={mine.id} onDone={refresh} />
            </>
          : info.reason !== null
            ? <p className="ev-note">{notBookableLabel(info.reason, mine?.status ?? null)}</p>
            : <>
                {mine?.status === "PENDING_PAYMENT" && <p className="ev-note">لديك حجز بانتظار الدفع. احجز مجددًا لتحديث العدد ثم أكمل الدفع.</p>}
                <Stepper value={quantity} max={max} onChange={setQuantity} label="عدد التذاكر" />
                <button type="button" className="button button-primary" disabled={busy} onClick={book}>{busy ? "لحظة…" : event.price === 0 ? "احجز مجانًا" : "احجز وادفع"}</button>
              </>}
      {error && <div className="ev-error" role="alert">
        <p>{error.message}</p>
        {error.showTicketsLink && <a href="/tickets#events">تذاكري</a>}
        {error.externalUrl && <a href={error.externalUrl} target="_blank" rel="noopener noreferrer">موقع المنظّم</a>}
      </div>}
    </section>
  </article>;
}

function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  return <div className="ev-stepper" role="group" aria-label={label}>
    <button type="button" aria-label="إنقاص" disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={16} /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label="زيادة" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={16} /></button>
  </div>;
}
