import type { MouseEvent } from "react";
import { Play } from "lucide-react";
import { formatDuration, mediaPath, mediaTitle, type MediaItem } from "@/lib/media";
import "./media.css";

/**
 * Always a real link to the item's page (crawlers, no-JS, new tab). With `onOpen` a plain
 * left click opens the lightbox instead; modified clicks keep their browser meaning.
 */
export function MediaCard({ item, onOpen }: { item: MediaItem; onOpen?: () => void }) {
  const duration = formatDuration(item.durationSeconds);
  const onClick = onOpen
    ? (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onOpen();
    }
    : undefined;
  return <a className={`md-card md-card-${item.kind}`} href={mediaPath(item)} onClick={onClick} aria-label={mediaTitle(item)}>
    {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <span className="md-card-blank" />}
    {item.kind === "video" && <span className="md-play" aria-hidden="true"><Play size={22} fill="currentColor" /></span>}
    {duration && <span className="md-duration">{duration}</span>}
    {item.caption && <span className="md-caption">{item.caption}</span>}
  </a>;
}
