"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EventTicketCard } from "@/components/event-ticket-card";
import { SeasonPassCard } from "@/components/season-pass-card";
import { TicketCard } from "@/components/ticket-card";
import type { MyEventBookingView } from "@/lib/events";
import { parseTicketCheckoutParams, type MySeasonPassView } from "@/lib/season-pass";
import type { TicketBookingView } from "@/lib/tickets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,255}$/;
type View = "checking" | "paid" | "failed" | "pending" | "invalid";
type PaymentState = { status?: string } | null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Unified result page for tickets: `?booking=` (match tickets), `?pass=` (season pass), or `?event=` (event booking); `payment` absent = free. */
export default function TicketResultClient() {
  const params = useSearchParams();
  const target = parseTicketCheckoutParams(params);
  const kind = target?.kind ?? null;
  const entityId = !target ? ""
    : target.kind === "pass" ? target.passId
    : target.kind === "booking" ? target.bookingId
    : target.subscriptionId;
  const isEvent = kind === "event" || kind === "event-add";
  const paymentId = params.get("payment") ?? "";
  const providerId = params.get("id") ?? "";
  const providerMessage = (params.get("message") ?? "").slice(0, 200);
  const [view, setView] = useState<View>("checking");
  const [bookings, setBookings] = useState<TicketBookingView[] | null>(null);
  const [pass, setPass] = useState<MySeasonPassView | null | undefined>(undefined);
  const [eventBooking, setEventBooking] = useState<MyEventBookingView | null | undefined>(undefined);

  useEffect(() => {
    if (!kind || (paymentId !== "" && !UUID.test(paymentId))) { setView("invalid"); return; }
    let cancelled = false;

    /** Tickets are generated when the booking is confirmed; retry briefly in case we are a moment early. */
    const loadTickets = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        const body = await fetch(`/api/tickets?booking=${entityId}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null)).catch(() => null);
        const list = Array.isArray(body?.bookings) ? (body.bookings as TicketBookingView[]) : [];
        if (list.some((booking) => booking.status === "CONFIRMED" && booking.tickets.length > 0)) {
          if (!cancelled) setBookings(list);
          return true;
        }
        await wait(2000);
      }
      if (!cancelled) setBookings([]);
      return false;
    };

    /** The pass turns ACTIVE (with its QR) when the payment is confirmed; retry briefly. */
    const loadPass = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const body = await fetch(`/api/season-passes?pass=${entityId}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null)).catch(() => null);
        const found = Array.isArray(body?.passes) ? (body.passes as MySeasonPassView[])[0] : undefined;
        if (found && found.status === "ACTIVE" && found.qrSvg) {
          if (!cancelled) setPass(found);
          return true;
        }
        await wait(2000);
      }
      if (!cancelled) setPass(null);
      return false;
    };

    /** Tickets are issued when the payment settles (free bookings: at booking time); retry briefly. */
    const loadEvent = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const body = await fetch(`/api/event-tickets?booking=${entityId}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null)).catch(() => null);
        const found = Array.isArray(body?.bookings) ? (body.bookings as MyEventBookingView[])[0] : undefined;
        if (found && found.status === "CONFIRMED" && found.tickets.length > 0) {
          if (!cancelled) setEventBooking(found);
          return true;
        }
        await wait(2000);
      }
      if (!cancelled) setEventBooking(null);
      return false;
    };

    const load = kind === "pass" ? loadPass : isEvent ? loadEvent : loadTickets;

    (async () => {
      // Free section or free pass: confirmed at booking time, there is no payment to verify.
      if (!paymentId) {
        const found = await load();
        if (!cancelled) setView(found ? "paid" : "pending");
        return;
      }
      // The URL's status is never trusted: web-api asks Moyasar and checks the metadata.
      const synced: PaymentState = await fetch(`/api/ticket-payments/${paymentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(PROVIDER_ID.test(providerId) ? { providerPaymentId: providerId } : {}),
      }).then((response) => (response.ok ? response.json() : null)).catch(() => null);
      let status = synced?.status ?? null;
      for (let attempt = 0; attempt < 10 && !cancelled && status !== "PAID" && status !== "FAILED"; attempt++) {
        await wait(3000);
        const state: PaymentState = await fetch(`/api/ticket-payments/${paymentId}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null)).catch(() => null);
        status = state?.status ?? null;
      }
      if (cancelled) return;
      if (status === "PAID") {
        setView("paid");
        await load();
      } else if (status === "FAILED") {
        setView("failed");
      } else {
        setView("pending");
      }
    })();

    return () => { cancelled = true; };
  }, [kind, entityId, paymentId, providerId, isEvent]);

  const isPass = kind === "pass";
  const myHref = isPass ? "/tickets#season-passes" : isEvent ? "/tickets#events" : "/tickets";
  const retryHref = isPass
    ? `/checkout/tickets/pay?pass=${encodeURIComponent(entityId)}`
    : kind === "event"
      ? `/checkout/tickets/pay?event=${encodeURIComponent(entityId)}`
      : kind === "event-add"
        ? "/tickets#events"
        : `/checkout/tickets/pay?booking=${encodeURIComponent(entityId)}`;

  return <main className="co-shell" dir="rtl">
    <div className="co-card tk-result" aria-live="polite">
      {view === "checking" && <><h1>نتحقق من الدفع…</h1><p>لا تغلق هذه الصفحة.</p></>}
      {view === "paid" && isPass && <>
        <h1>تم! تذكرتك الموسمية جاهزة</h1>
        {pass === undefined
          ? <p role="status">نجهّز تذكرتك…</p>
          : pass === null
            ? <p>ستظهر تذكرتك في صفحة «تذاكري» خلال دقائق.</p>
            : <SeasonPassCard pass={pass} />}
        <a className="acc-primary" href={myHref}>تذاكري</a>
      </>}
      {view === "paid" && isEvent && <>
        <h1>تم! تذاكر الفعالية جاهزة</h1>
        {eventBooking === undefined
          ? <p role="status">نجهّز تذاكرك…</p>
          : eventBooking === null
            ? <p>ستظهر تذاكرك في صفحة «تذاكري» خلال دقائق.</p>
            : <EventTicketCard booking={eventBooking} />}
        <a className="acc-primary" href={myHref}>تذاكري</a>
      </>}
      {view === "paid" && !isPass && !isEvent && <>
        <h1>تم! تذاكرك جاهزة</h1>
        {bookings === null
          ? <p role="status">نجهّز تذاكرك…</p>
          : bookings.length === 0
            ? <p>ستظهر تذاكرك في صفحة «تذاكري» خلال دقائق.</p>
            : bookings.map((booking) => <TicketCard key={booking.id} booking={booking} />)}
        <a className="acc-primary" href={myHref}>تذاكري</a>
      </>}
      {view === "failed" && <>
        <h1>لم تكتمل عملية الدفع</h1>
        {providerMessage && <p className="acc-note">{providerMessage}</p>}
        <a className="acc-primary" href={retryHref}>حاول الدفع مجددًا</a>
      </>}
      {view === "pending" && <>
        <h1>ما زلنا ننتظر التأكيد</h1>
        <p>{isPass ? "ستظهر تذكرتك" : "ستظهر التذاكر"} في صفحة «تذاكري» خلال دقائق. لا تكرر الدفع.</p>
        <a className="acc-primary" href={myHref}>تذاكري</a>
      </>}
      {view === "invalid" && <>
        <h1>رابط غير صالح</h1>
        <a className="co-back" href={isPass ? "/season-pass" : isEvent ? "/events" : "/matches"}>{isPass ? "التذكرة الموسمية" : isEvent ? "الفعاليات" : "تذاكر المباريات"}</a>
      </>}
    </div>
  </main>;
}
