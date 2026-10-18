import { z } from "zod";
import { SITE_URL } from "./product-seo";
import { absoluteAssetUrl } from "./upstream";

/** web-api PhotoCategory values, in the order the chips are shown. */
export const MEDIA_CATEGORIES = [
  { id: "GENERAL", label: "عام" },
  { id: "TRAINING", label: "تدريب" },
  { id: "EVENTS", label: "فعاليات" },
  { id: "RENOVATIONS", label: "ترميمات" },
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number]["id"];
export type MediaKind = "photo" | "video";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  /** Full-size photo, or the video poster. Null only for a video without a poster. */
  image: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  caption: string;
  category: MediaCategory | null;
  publishedAt: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMediaId(value: string): boolean {
  return UUID.test(value);
}

export function parseCategory(value: unknown): MediaCategory | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return MEDIA_CATEGORIES.find((category) => category.id === raw)?.id;
}

/** "?type=video" → "video". Anything else → undefined (photos and videos together). */
export function parseMediaKind(value: unknown): MediaKind | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "photo" || raw === "video" ? raw : undefined;
}

export function categoryLabel(category: MediaCategory | null): string {
  return MEDIA_CATEGORIES.find((entry) => entry.id === category)?.label ?? "";
}

/** 45 → "0:45", 75 → "1:15". Null for a missing or invalid duration (no badge). */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const rowSchema = z.object({
  id: z.string(),
  media_type: z.enum(["PHOTO", "VIDEO"]),
  image_url: z.string().nullish(),
  thumbnail_url: z.string().nullish(),
  caption_ar: z.string().nullish(),
  category: z.string().nullish(),
  created_at: z.string().nullish(),
  video_url: z.string().nullish(),
  video_duration_seconds: z.number().nullish().catch(null),
});

/** null for a row with a bad id, a photo without a safe image or a video without a safe file. */
export function toMediaItem(row: unknown): MediaItem | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success || !isMediaId(parsed.data.id)) return null;
  const data = parsed.data;
  const kind: MediaKind = data.media_type === "VIDEO" ? "video" : "photo";
  const image = absoluteAssetUrl(data.image_url);
  const videoUrl = kind === "video" ? absoluteAssetUrl(data.video_url) : null;
  if (kind === "photo" && !image) return null;
  if (kind === "video" && !videoUrl) return null;
  const publishedAt = data.created_at && !Number.isNaN(Date.parse(data.created_at)) ? new Date(data.created_at).toISOString() : null;
  return {
    id: data.id,
    kind,
    image,
    thumbnail: absoluteAssetUrl(data.thumbnail_url) ?? image,
    videoUrl,
    durationSeconds: kind === "video" ? data.video_duration_seconds ?? null : null,
    caption: (data.caption_ar ?? "").trim(),
    category: parseCategory(data.category) ?? null,
    publishedAt,
  };
}

/** The one gallery page: photos and videos together, `?type=` narrows it. */
export const GALLERY_PATH = "/gallery";

/** The gallery filtered to one kind ("/gallery?type=video"). */
export function mediaListPath(kind: MediaKind): string {
  return `${GALLERY_PATH}?type=${kind}`;
}

/** Item pages keep their own prefixes so links already shared keep working. */
export function mediaPath(item: Pick<MediaItem, "kind" | "id">): string {
  return `${item.kind === "video" ? "/videos" : GALLERY_PATH}/${item.id}`;
}

export function mediaUrl(item: Pick<MediaItem, "kind" | "id">): string {
  return `${SITE_URL}${mediaPath(item)}`;
}

export function mediaTitle(item: Pick<MediaItem, "kind" | "caption">): string {
  return item.caption || (item.kind === "video" ? "فيديو من نادي الأنصار" : "صورة من نادي الأنصار");
}

/** "تدريب · 1 أكتوبر 2026", skipping whichever part is missing. */
export function mediaMeta(item: Pick<MediaItem, "category" | "publishedAt">, formatDate: (iso: string | null) => string): string {
  return [categoryLabel(item.category), formatDate(item.publishedAt)].filter(Boolean).join(" · ");
}

export const GALLERY_COPY = {
  title: "المعرض",
  intro: "صور ومقاطع من التدريبات والمباريات وفعاليات النادي وخلف الكواليس.",
  empty: "لا يوجد محتوى هنا بعد",
};

/** Type filter chips, in display order (undefined = الكل). */
export const MEDIA_KIND_FILTERS: { kind: MediaKind | undefined; label: string }[] = [
  { kind: undefined, label: "الكل" },
  { kind: "photo", label: "الصور" },
  { kind: "video", label: "الفيديو" },
];

export const MEDIA_COPY: Record<MediaKind, { empty: string; all: string; related: string }> = {
  photo: { empty: "لا توجد صور هنا بعد", all: "كل الصور", related: "صور أخرى" },
  video: { empty: "لا توجد فيديوهات هنا بعد", all: "كل الفيديوهات", related: "فيديوهات أخرى" },
};

export function mediaJsonLd(item: MediaItem): Record<string, unknown> {
  const name = mediaTitle(item);
  const published = item.publishedAt ? { uploadDate: item.publishedAt } : {};
  if (item.kind === "video") {
    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name,
      description: item.caption || name,
      thumbnailUrl: [item.image ?? `${SITE_URL}/images/logo.svg`],
      contentUrl: item.videoUrl,
      url: mediaUrl(item),
      ...published,
      ...(item.durationSeconds !== null ? { duration: `PT${Math.round(item.durationSeconds)}S` } : {}),
    };
  }
  return { "@context": "https://schema.org", "@type": "ImageObject", name, contentUrl: item.image, url: mediaUrl(item), ...published };
}
