"use client";

import { useState } from "react";
import type { EventSummary } from "@/lib/events";
import type { StoreData } from "@/lib/types";
import { EventCard } from "./event-card";
import { StoreShell } from "./store-shell";
import "./events.css";
import "./matches.css";

/** Client half of /events. The server half (data, metadata) is app/events/page.tsx. */
export default function EventsPage({ store, events }: { store: StoreData; events: EventSummary[] }) {
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
    {() => <main id="main-content" className="ev-page section-shell">
      <span className="section-kicker">فعاليات الأنصار</span>
      <h1>الفعاليات<span className="heading-dot">.</span></h1>
      <p className="ev-intro">احجز مكانك في فعاليات النادي وادفع إلكترونيًا، وتصلك تذاكر الدخول فورًا.</p>
      {events.length === 0
        ? <div className="mt-empty"><h2>لا توجد فعاليات قادمة الآن</h2><p>نعلن عن الفعاليات فور فتح الحجز.</p><a className="button button-primary" href="/">تصفّح المتجر</a></div>
        : <div className="ev-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>}
    </main>}
  </StoreShell>;
}
