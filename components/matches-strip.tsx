"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { TicketedMatch } from "@/lib/matches";
import { MatchCard } from "./match-card";
import "./matches.css";

/** Next three ticketed matches on the home page. Renders nothing when there are none or web-api is down. */
export function MatchesStrip() {
  const [matches, setMatches] = useState<TicketedMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/matches")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled && Array.isArray(body?.matches)) setMatches((body.matches as TicketedMatch[]).slice(0, 3)); })
      .catch(() => { /* no strip when web-api is down */ });
    return () => { cancelled = true; };
  }, []);

  if (matches.length === 0) return null;

  return <section className="mt-strip section-shell" aria-labelledby="mt-strip-title">
    <div className="mt-strip-head">
      <div><span className="section-kicker">تذاكر المباريات</span><h2 id="mt-strip-title">احجز مقعدك في المدرج<span className="heading-dot">.</span></h2></div>
      <a className="text-button" href="/matches">كل المباريات <ArrowLeft size={16} /></a>
    </div>
    <div className="mt-grid">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>
  </section>;
}
