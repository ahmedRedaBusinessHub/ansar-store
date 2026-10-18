"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { MediaItem } from "@/lib/media";
import { MediaCard } from "./media-card";
import "./content.css";

/** Latest six photos and videos. Cards link to their own pages (no lightbox here). Renders nothing on empty/failure. */
export function MediaStrip() {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gallery")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled && Array.isArray(body?.items)) setItems((body.items as MediaItem[]).slice(0, 6)); })
      .catch(() => { /* no strip when web-api is down */ });
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0) return null;

  return <section className="ct-strip section-shell" aria-labelledby="md-strip-title">
    <div className="ct-strip-head">
      <div><span className="section-kicker">المركز الإعلامي</span><h2 id="md-strip-title">من المعرض<span className="heading-dot">.</span></h2></div>
      <a className="text-button" href="/gallery">المعرض كاملًا <ArrowLeft size={16} /></a>
    </div>
    <div className="md-grid md-grid-strip">{items.map((item) => <MediaCard key={item.id} item={item} />)}</div>
  </section>;
}
