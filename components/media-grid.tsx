"use client";

import { useEffect, useState } from "react";
import { mediaPath, type MediaItem } from "@/lib/media";
import { MediaCard } from "./media-card";
import { MediaLightbox } from "./media-lightbox";

const STATE_KEY = "mediaLightbox";

/**
 * Grid + lightbox (spec D3). Opening pushes the item's own URL; moving replaces it (no extra
 * history entries); Back closes; Esc and the close button go back so the list URL returns.
 * Next.js's patched pushState keeps its own router state alongside STATE_KEY.
 */
export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const isOpen = index !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onPopState = () => setIndex(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isOpen]);

  const open = (next: number) => {
    window.history.pushState({ [STATE_KEY]: true }, "", mediaPath(items[next]));
    setIndex(next);
  };
  const move = (next: number) => {
    window.history.replaceState({ ...window.history.state, [STATE_KEY]: true }, "", mediaPath(items[next]));
    setIndex(next);
  };
  const close = () => {
    if (window.history.state?.[STATE_KEY]) window.history.back(); // popstate closes it
    else setIndex(null);
  };

  return <>
    <div className="md-grid">{items.map((item, i) => <MediaCard key={item.id} item={item} onOpen={() => open(i)} />)}</div>
    {index !== null && <MediaLightbox items={items} index={index} onMove={move} onClose={close} />}
  </>;
}
