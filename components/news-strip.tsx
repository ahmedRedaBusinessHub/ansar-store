"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { NewsCardData } from "@/lib/news";
import { NewsCard } from "./news-card";
import "./content.css";

/** Latest three news on the home page. Renders nothing when there are none or web-api is down. */
export function NewsStrip() {
  const [news, setNews] = useState<NewsCardData[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/news")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled && Array.isArray(body?.news)) setNews((body.news as NewsCardData[]).slice(0, 3)); })
      .catch(() => { /* no strip when web-api is down */ });
    return () => { cancelled = true; };
  }, []);

  if (news.length === 0) return null;

  return <section className="ct-strip section-shell" aria-labelledby="nw-strip-title">
    <div className="ct-strip-head">
      <div><span className="section-kicker">المركز الإعلامي</span><h2 id="nw-strip-title">آخر الأخبار<span className="heading-dot">.</span></h2></div>
      <a className="text-button" href="/news">كل الأخبار <ArrowLeft size={16} /></a>
    </div>
    <div className="nw-grid">{news.map((item) => <NewsCard key={item.id} item={item} />)}</div>
  </section>;
}
