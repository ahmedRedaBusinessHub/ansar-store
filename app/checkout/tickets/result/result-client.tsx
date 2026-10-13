"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TicketCard } from "@/components/ticket-card";
import type { TicketBookingView } from "@/lib/tickets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,255}$/;
type View = "checking" | "paid" | "failed" | "pending" | "invalid";
type PaymentState = { status?: string } | null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TicketResultClient() {
  const params = useSearchParams();
  const paymentId = params.get("payment") ?? "";
  const bookingId = params.get("booking") ?? "";
  const providerId = params.get("id") ?? "";
  const providerMessage = (params.get("message") ?? "").slice(0, 200);
  const [view, setView] = useState<View>("checking");
  const [bookings, setBookings] = useState<TicketBookingView[] | null>(null);

  useEffect(() => {
    if (!UUID.test(bookingId) || (paymentId !== "" && !UUID.test(paymentId))) { setView("invalid"); return; }
    let cancelled = false;

    /** Tickets are generated when the booking is confirmed; retry briefly in case we are a moment early. */
    const loadTickets = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        const body = await fetch(`/api/tickets?booking=${bookingId}`, { cache: "no-store" })
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

    (async () => {
      // Free section: confirmed at booking time, there is no payment to verify.
      if (!paymentId) {
        const found = await loadTickets();
        if (!cancelled) setView(found ? "paid" : "pending");
        return;
      }
      // The URL's status is never trusted: web-api asks Moyasar and checks the metadata.
      const synced: PaymentState = await fetch(`/api/match-payments/${paymentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(PROVIDER_ID.test(providerId) ? { providerPaymentId: providerId } : {}),
      }).then((response) => (response.ok ? response.json() : null)).catch(() => null);
      let status = synced?.status ?? null;
      for (let attempt = 0; attempt < 10 && !cancelled && status !== "PAID" && status !== "FAILED"; attempt++) {
        await wait(3000);
        const state: PaymentState = await fetch(`/api/match-payments/${paymentId}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null)).catch(() => null);
        status = state?.status ?? null;
      }
      if (cancelled) return;
      if (status === "PAID") {
        setView("paid");
        await loadTickets();
      } else if (status === "FAILED") {
        setView("failed");
      } else {
        setView("pending");
      }
    })();

    return () => { cancelled = true; };
  }, [paymentId, bookingId, providerId]);

  return <main className="co-shell" dir="rtl">
    <div className="co-card tk-result" aria-live="polite">
      {view === "checking" && <><h1>نتحقق من الدفع…</h1><p>لا تغلق هذه الصفحة.</p></>}
      {view === "paid" && <>
        <h1>تم! تذاكرك جاهزة</h1>
        {bookings === null
          ? <p role="status">نجهّز تذاكرك…</p>
          : bookings.length === 0
            ? <p>ستظهر تذاكرك في صفحة «تذاكري» خلال دقائق.</p>
            : bookings.map((booking) => <TicketCard key={booking.id} booking={booking} />)}
        <a className="acc-primary" href="/tickets">تذاكري</a>
      </>}
      {view === "failed" && <>
        <h1>لم تكتمل عملية الدفع</h1>
        {providerMessage && <p className="acc-note">{providerMessage}</p>}
        <a className="acc-primary" href={`/checkout/tickets/pay?booking=${encodeURIComponent(bookingId)}`}>حاول الدفع مجددًا</a>
      </>}
      {view === "pending" && <>
        <h1>ما زلنا ننتظر التأكيد</h1>
        <p>ستظهر التذاكر في صفحة «تذاكري» خلال دقائق. لا تكرر الدفع.</p>
        <a className="acc-primary" href="/tickets">تذاكري</a>
      </>}
      {view === "invalid" && <><h1>رابط غير صالح</h1><a className="co-back" href="/matches">تذاكر المباريات</a></>}
    </div>
  </main>;
}
