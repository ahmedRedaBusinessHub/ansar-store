import { Download, MapPin, Wallet } from "lucide-react";
import { formatMatchDate, formatMatchTime, HOME_TEAM_AR } from "@/lib/matches";
import type { TicketBookingView } from "@/lib/tickets";
import "./ticket-card.css";

const STATUS_LABEL: Record<"UNUSED" | "USED" | "CANCELLED", string> = { UNUSED: "صالحة", USED: "مستخدمة", CANCELLED: "ملغاة" };

export function bookingTitle(booking: Pick<TicketBookingView, "isHome" | "opponentNameAr">): string {
  return booking.isHome ? `${HOME_TEAM_AR} × ${booking.opponentNameAr}` : `${booking.opponentNameAr} × ${HOME_TEAM_AR}`;
}

/** A confirmed booking with one QR per ticket and download links. */
export function TicketCard({ booking }: { booking: TicketBookingView }) {
  return <article className="tk-card">
    <header className="tk-head">
      <h2>{bookingTitle(booking)}</h2>
      <p>{formatMatchDate(booking.date)} · {formatMatchTime(booking.date)}</p>
      <p><MapPin size={14} /> {booking.stadiumAr}{booking.sectionNameAr ? ` · ${booking.sectionNameAr}` : ""}</p>
    </header>
    <ul className="tk-list">
      {booking.tickets.map((ticket) => <li key={ticket.id} className="tk-ticket">
        {/* SVG generated server-side by the qrcode library from the ticket payload. */}
        <div className="tk-qr" role="img" aria-label={`رمز دخول التذكرة رقم ${ticket.number}`} dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
        <div className="tk-info">
          <b>تذكرة رقم {ticket.number}</b>
          <span className={`tk-status tk-${ticket.status.toLowerCase()}`}>{STATUS_LABEL[ticket.status]}</span>
          <div className="tk-actions">
            <a href={`/api/tickets/${ticket.id}/pdf`}><Download size={15} /> PDF</a>
            <a href={`/api/tickets/${ticket.id}/wallet/apple`}><Wallet size={15} /> Apple Wallet</a>
            <a href={`/api/tickets/${ticket.id}/wallet/google`}><Wallet size={15} /> Google Wallet</a>
          </div>
        </div>
      </li>)}
    </ul>
  </article>;
}
