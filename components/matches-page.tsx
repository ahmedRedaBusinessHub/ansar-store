"use client";

import { useState } from "react";
import type { TicketedMatch } from "@/lib/matches";
import type { StoreData } from "@/lib/types";
import { MatchCard } from "./match-card";
import { StoreShell } from "./store-shell";
import "./matches.css";

/** Client half of /matches. The server half (data, metadata) is app/matches/page.tsx. */
export default function MatchesPage({ store, matches }: { store: StoreData; matches: TicketedMatch[] }) {
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
    {() => <main id="main-content" className="mt-page section-shell">
      <span className="section-kicker">مباريات الأنصار</span>
      <h1>تذاكر المباريات<span className="heading-dot">.</span></h1>
      <p className="mt-page-intro">اختر المباراة والمدرج، وادفع إلكترونيًا، وتصلك تذاكرك فورًا مع رمز الدخول.</p>
      {matches.length === 0
        ? <div className="mt-empty"><h2>لا توجد مباريات متاحة للحجز الآن</h2><p>نعلن عن التذاكر فور فتح البيع.</p><a className="button button-primary" href="/">تصفّح المتجر</a></div>
        : <div className="mt-grid">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>}
    </main>}
  </StoreShell>;
}
