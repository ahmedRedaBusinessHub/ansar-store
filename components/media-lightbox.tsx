"use client";

import { useRef, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPublishedDate } from "@/lib/content";
import { mediaMeta, mediaTitle, mediaUrl, type MediaItem } from "@/lib/media";
import { CloseButton, Dialog } from "./dialog";
import { ShareButtons } from "./share-buttons";
import "./media.css";

const SWIPE_PX = 50;

/**
 * Full-screen viewer over the items already loaded on the page (no fetching, spec D8).
 * RTL: ArrowLeft / swipe right = next, ArrowRight / swipe left = previous.
 * Mounted only while open, so a playing video stops when it closes; `key` remounts it on move.
 */
export function MediaLightbox({ items, index, onMove, onClose }: {
  items: MediaItem[]; index: number; onMove: (index: number) => void; onClose: () => void;
}) {
  const item = items[index];
  const touchX = useRef<number | null>(null);
  const hasPrevious = index > 0;
  const hasNext = index < items.length - 1;
  const previous = () => { if (hasPrevious) onMove(index - 1); };
  const next = () => { if (hasNext) onMove(index + 1); };
  const title = mediaTitle(item);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === "VIDEO") return; // arrows seek inside the player
    if (event.key === "ArrowLeft") { event.preventDefault(); next(); }
    if (event.key === "ArrowRight") { event.preventDefault(); previous(); }
  };
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => { touchX.current = event.touches[0]?.clientX ?? null; };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchX.current;
    touchX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    if (end - start > SWIPE_PX) next();
    else if (start - end > SWIPE_PX) previous();
  };

  return <Dialog open onClose={onClose} titleId="md-lightbox-title" className="md-lightbox">
    <div className="md-lightbox-inner" onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="md-lightbox-bar">
        <span className="md-counter">{index + 1} / {items.length}</span>
        <CloseButton onClose={onClose} />
      </div>
      <div className="md-stage">
        <button type="button" className="md-nav" onClick={previous} disabled={!hasPrevious} aria-label="السابق"><ChevronRight size={26} /></button>
        {item.kind === "video"
          ? <video key={item.id} className="md-media" src={item.videoUrl ?? undefined} poster={item.image ?? undefined} controls playsInline preload="none" />
          : <img key={item.id} className="md-media" src={item.image ?? undefined} alt={title} />}
        <button type="button" className="md-nav" onClick={next} disabled={!hasNext} aria-label="التالي"><ChevronLeft size={26} /></button>
      </div>
      <div className="md-lightbox-info">
        <h2 id="md-lightbox-title">{title}</h2>
        <p>{mediaMeta(item, formatPublishedDate)}</p>
        <ShareButtons url={mediaUrl(item)} title={title} />
      </div>
    </div>
  </Dialog>;
}
