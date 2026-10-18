import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStore } from "@/lib/catalog";
import { parsePage } from "@/lib/content";
import { categoryLabel, GALLERY_COPY, GALLERY_PATH, mediaJsonLd, mediaPath, mediaTitle, mediaUrl, parseCategory, parseMediaKind, type MediaKind } from "@/lib/media";
import { fetchMediaItem, fetchMediaPage } from "@/lib/media-data";
import { jsonLdScript, STORE_NAME } from "@/lib/product-seo";
import { MediaDetail } from "./media-detail";
import { MediaPage, type MediaPageData } from "./media-page";
import { SitePage } from "./site-page";

/** Must equal `revalidate` exported by the route files (Next reads that export statically). */
const CACHE = { revalidate: 300 };
const RELATED_COUNT = 6;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function mediaListMetadata(): Metadata {
  return { title: `${GALLERY_COPY.title} | ${STORE_NAME}`, description: GALLERY_COPY.intro, alternates: { canonical: GALLERY_PATH } };
}

export async function MediaListRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const kind = parseMediaKind(params.type);
  const category = parseCategory(params.category); // unknown value → all categories
  const page = parsePage(params.page);
  const [store, data] = await Promise.all([
    readStore(CACHE), // a throw → error.tsx
    fetchMediaPage(kind ?? "all", { ...CACHE, category, page }).then(
      ({ items, page: current, pagesCount }): MediaPageData => ({ items, page: current, pagesCount }),
      (): MediaPageData => null,
    ),
  ]);
  return <SitePage store={store}><MediaPage kind={kind} category={category} data={data} /></SitePage>;
}

export async function mediaDetailMetadata(kind: MediaKind, id: string): Promise<Metadata> {
  const item = await fetchMediaItem(kind, id, CACHE).catch(() => null);
  if (!item) return { title: `غير متاح | ${STORE_NAME}`, robots: { index: false, follow: false } };
  const title = mediaTitle(item);
  const description = item.caption || [title, categoryLabel(item.category)].filter(Boolean).join(" — ");
  return {
    title: `${title} | ${STORE_NAME}`,
    description,
    alternates: { canonical: mediaPath(item) },
    openGraph: {
      type: kind === "video" ? "video.other" : "website",
      url: mediaUrl(item), siteName: STORE_NAME, locale: "ar_SA", title, description,
      ...(item.image ? { images: [item.image] } : {}),
      ...(kind === "video" && item.videoUrl ? { videos: [{ url: item.videoUrl, type: "video/mp4" }] } : {}),
    },
    twitter: { card: item.image ? "summary_large_image" : "summary", title, description },
  };
}

export async function MediaDetailRoute({ kind, id }: { kind: MediaKind; id: string }) {
  const [store, item] = await Promise.all([readStore(CACHE), fetchMediaItem(kind, id, CACHE)]); // a throw → error.tsx
  if (!item) notFound();
  const related = await fetchMediaPage(kind, { ...CACHE, category: item.category ?? undefined, perPage: RELATED_COUNT + 1 }).then(
    (result) => result.items.filter((entry) => entry.id !== item.id).slice(0, RELATED_COUNT),
    () => [],
  );
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(mediaJsonLd(item)) }} />
    <SitePage store={store}><MediaDetail item={item} related={related} /></SitePage>
  </>;
}
