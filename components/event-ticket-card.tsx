import type React from "react";
import { CalendarDays } from "lucide-react";
import { eventDateLabel, type MyEventBookingView } from "@/lib/events";
import "./ticket-card.css";

const STATUS_LABEL: Record<"UNUSED" | "USED" | "CANCELLED", string> = { UNUSED: "صالحة", USED: "مستخدمة", CANCELLED: "ملغاة" };

/** A confirmed event booking with one QR per ticket. Event tickets have no PDF or Wallet (web-api has none). */
export function EventTicketCard({ booking, footer }: { booking: MyEventBookingView; footer?: React.ReactNode }) {
  return <article className="tk-card">
    <header className="tk-head">
      <h2>{booking.event.titleAr}</h2>
      <p><CalendarDays size={14} /> {eventDateLabel(booking.event.date)}</p>
    </header>
    <ul className="tk-list">
      {booking.tickets.map((ticket) => <li key={ticket.id} className="tk-ticket">
        {/* SVG generated server-side by the qrcode library from the ticket payload. */}
        <div className="tk-qr" role="img" aria-label={`رمز دخول التذكرة رقم ${ticket.number}`} dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
        <div className="tk-info">
          <b>تذكرة رقم {ticket.number}</b>
          <span className={`tk-status tk-${ticket.status.toLowerCase()}`}>{STATUS_LABEL[ticket.status]}</span>
        </div>
      </li>)}
    </ul>
    {footer}
  </article>;
}
