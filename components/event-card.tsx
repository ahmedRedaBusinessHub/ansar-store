import { CalendarDays } from "lucide-react";
import { eventDateLabel, eventPath, eventPriceLabel, type EventSummary } from "@/lib/events";

export function EventCard({ event }: { event: EventSummary }) {
  const badge = event.externalUrl ? "حجز خارجي"
    : event.availability?.full ? "مكتمل"
    : event.availability ? `متبقٍ ${event.availability.available}` : null;
  return <a className="ev-card" href={eventPath(event.id)}>
    {event.image ? <img src={event.image} alt="" loading="lazy" /> : <span className="ev-card-fallback" aria-hidden="true" />}
    <div className="ev-card-body">
      <h2>{event.titleAr}</h2>
      <p><CalendarDays size={14} /> {eventDateLabel(event.date)}</p>
      <p className="ev-card-meta"><b>{eventPriceLabel(event.price)}</b>{badge && <span className="ev-badge">{badge}</span>}</p>
    </div>
  </a>;
}
