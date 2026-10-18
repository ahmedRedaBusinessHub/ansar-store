import { ArrowRight } from "lucide-react";
import { formatPublishedDate } from "@/lib/content";
import { MEDIA_COPY, mediaListPath, mediaMeta, mediaTitle, mediaUrl, type MediaItem } from "@/lib/media";
import { MediaCard } from "./media-card";
import { ShareButtons } from "./share-buttons";
import "./media.css";

/** The page a shared /gallery/{id} or /videos/{id} link opens. */
export function MediaDetail({ item, related }: { item: MediaItem; related: MediaItem[] }) {
  const copy = MEDIA_COPY[item.kind];
  const title = mediaTitle(item);
  return <main id="main-content" className="ct-page section-shell">
    <a className="text-button" href={mediaListPath(item.kind)}><ArrowRight size={16} /> {copy.all}</a>
    <figure className="md-detail-figure">
      {item.kind === "video"
        ? <video className="md-detail-media" src={item.videoUrl ?? undefined} poster={item.image ?? undefined} controls playsInline preload="metadata" />
        : <img className="md-detail-media" src={item.image ?? undefined} alt={title} />}
      <figcaption>
        <h1>{title}</h1>
        <p>{mediaMeta(item, formatPublishedDate)}</p>
      </figcaption>
    </figure>
    <ShareButtons url={mediaUrl(item)} title={title} />
    {related.length > 0 && <section className="md-related" aria-labelledby="md-related-title">
      <h2 id="md-related-title">{copy.related}<span className="heading-dot">.</span></h2>
      <div className="md-grid">{related.map((entry) => <MediaCard key={entry.id} item={entry} />)}</div>
    </section>}
  </main>;
}
