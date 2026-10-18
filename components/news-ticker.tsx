import { newsPath, type NewsCardData } from "@/lib/news";
import "./news.css";

/**
 * Scrolling important-news headlines. Pure CSS: pauses on hover/focus, and under
 * prefers-reduced-motion becomes a static wrapped list (the duplicate copy is hidden).
 */
export function NewsTicker({ items }: { items: NewsCardData[] }) {
  if (items.length === 0) return null;
  const list = (duplicate: boolean) => <ul aria-hidden={duplicate || undefined}>
    {items.map((item) => <li key={item.id}><a href={newsPath(item.id)} tabIndex={duplicate ? -1 : undefined}>{item.title}</a></li>)}
  </ul>;
  return <div className="nw-ticker" role="region" aria-label="أخبار مهمة">
    <span className="nw-ticker-label">أخبار مهمة</span>
    <div className="nw-ticker-track"><div className="nw-ticker-run">{list(false)}{list(true)}</div></div>
  </div>;
}
