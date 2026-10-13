import { CalendarDays, MapPin, Ticket } from "lucide-react";
import {
  formatMatchDate, formatMatchTime, formatSectionPrice, HOME_TEAM_AR, matchPath, salesOpeningLabel, type TicketedMatch,
} from "@/lib/matches";

/** Card for a ticketed (home) match. Used by the home strip and /matches. */
export function MatchCard({ match }: { match: TicketedMatch }) {
  return <article className="mt-card">
    <a className="mt-card-link" href={matchPath(match.id)} aria-label={`${HOME_TEAM_AR} × ${match.opponent.nameAr}`}>
      <div className="mt-teams">
        <span className="mt-team"><img src="/images/crest.svg" alt="" width="52" height="52" /><b>{HOME_TEAM_AR}</b></span>
        <span className="mt-vs" aria-hidden="true">×</span>
        <span className="mt-team">
          {match.opponent.logo
            ? <img src={match.opponent.logo} alt="" width="52" height="52" />
            : <span className="mt-logo-fallback" aria-hidden="true">{match.opponent.nameAr.slice(0, 1)}</span>}
          <b>{match.opponent.nameAr}</b>
        </span>
      </div>
      <p className="mt-meta"><CalendarDays size={15} /> {formatMatchDate(match.date)} · {formatMatchTime(match.date)}</p>
      <p className="mt-meta"><MapPin size={15} /> {match.stadiumAr}</p>
      <div className="mt-card-bottom">
        {match.salesState === "OPEN"
          ? <span className="mt-badge mt-badge-open"><Ticket size={14} /> التذاكر متاحة</span>
          : <span className="mt-badge">{match.salesOpenAt ? salesOpeningLabel(match.salesOpenAt) : "البيع قريبًا"}</span>}
        {match.minPrice !== null && <span className="mt-price">{match.minPrice === 0 ? "دخول مجاني" : `من ${formatSectionPrice(match.minPrice)}`}</span>}
      </div>
    </a>
  </article>;
}
