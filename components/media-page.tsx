import { listHref } from "@/lib/content";
import { GALLERY_COPY, GALLERY_PATH, MEDIA_CATEGORIES, MEDIA_COPY, MEDIA_KIND_FILTERS, type MediaCategory, type MediaItem, type MediaKind } from "@/lib/media";
import { ContentUnavailable, Pager } from "./content-parts";
import { MediaGrid } from "./media-grid";
import "./media.css";

/** null = web-api unreachable. */
export type MediaPageData = { items: MediaItem[]; page: number; pagesCount: number } | null;

export function MediaPage({ kind, category, data }: { kind?: MediaKind; category?: MediaCategory; data: MediaPageData }) {
  return <main id="main-content" className="ct-page section-shell">
    <div className="ct-head">
      <div>
        <span className="section-kicker">المركز الإعلامي</span>
        <h1>{GALLERY_COPY.title}<span className="heading-dot">.</span></h1>
      </div>
    </div>
    <p className="ct-intro">{GALLERY_COPY.intro}</p>
    <nav className="md-chips" aria-label="نوع الوسائط">
      {MEDIA_KIND_FILTERS.map((entry) => <a key={entry.kind ?? "all"} href={listHref(GALLERY_PATH, { type: entry.kind, category })} aria-current={kind === entry.kind ? "page" : undefined}>{entry.label}</a>)}
    </nav>
    <nav className="md-chips" aria-label="التصنيفات">
      <a href={listHref(GALLERY_PATH, { type: kind })} aria-current={category ? undefined : "page"}>الكل</a>
      {MEDIA_CATEGORIES.map((entry) => <a key={entry.id} href={listHref(GALLERY_PATH, { type: kind, category: entry.id })} aria-current={category === entry.id ? "page" : undefined}>{entry.label}</a>)}
    </nav>
    {data === null
      ? <ContentUnavailable retryHref={listHref(GALLERY_PATH, { type: kind, category })} />
      : data.items.length === 0
        ? <div className="ct-empty"><h2>{kind ? MEDIA_COPY[kind].empty : GALLERY_COPY.empty}</h2>{(kind || category || data.page > 1) && <a className="button button-outline" href={GALLERY_PATH}>عرض الكل</a>}</div>
        : <MediaGrid items={data.items} />}
    {data && <Pager page={data.page} pagesCount={data.pagesCount} href={(page) => listHref(GALLERY_PATH, { type: kind, category, page })} />}
  </main>;
}
