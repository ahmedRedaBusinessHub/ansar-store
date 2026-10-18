import type { MetadataRoute } from "next";
import { z } from "zod";
import { stripHtml } from "./adapter";
import { SITE_URL } from "./product-seo";
import { decodeEntities } from "./sanitize-html";
import { absoluteAssetUrl } from "./upstream";

export type NewsItem = {
  id: string;
  title: string;
  /** Raw article HTML from web-api. Render it only through sanitizeHtml. */
  html: string;
  summary: string;
  image: string | null;
  isImportant: boolean;
  publishedAt: string | null;
};

/** What a news card shows. The home strip proxy sends this shape to keep article bodies out of the payload. */
export type NewsCardData = Omit<NewsItem, "html">;

const NEWS_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SUMMARY_MAX = 160;
const WORDS_PER_MINUTE = 200;

/** web-api serves local UUIDs or WordPress post ids; both are URL-safe tokens. */
export function isNewsId(value: string): boolean {
  return NEWS_ID.test(value);
}

/** Text content with tags removed and entities (including WordPress's &#8211;) decoded. */
export function plainText(html: string): string {
  return decodeEntities(stripHtml(html)).replace(/ /g, " ").trim();
}

export function excerpt(html: string, max = SUMMARY_MAX): string {
  const text = plainText(html).replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function readingMinutes(html: string): number {
  const words = plainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const validDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const rowSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title_ar: z.string(),
  description_ar: z.string().nullish(),
  image_url: z.string().nullish(),
  is_important: z.boolean().nullish().catch(false),
  created_at: validDate.nullish().catch(null),
});

/** null for a row without a usable id or title. */
export function toNewsItem(row: unknown): NewsItem | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success || !isNewsId(parsed.data.id)) return null;
  const title = plainText(parsed.data.title_ar);
  if (!title) return null;
  const html = parsed.data.description_ar ?? "";
  return {
    id: parsed.data.id,
    title,
    html,
    summary: excerpt(html),
    image: absoluteAssetUrl(parsed.data.image_url),
    isImportant: parsed.data.is_important === true,
    publishedAt: parsed.data.created_at ? new Date(parsed.data.created_at).toISOString() : null,
  };
}

export function toNewsCard(item: NewsItem): NewsCardData {
  return {
    id: item.id, title: item.title, summary: item.summary, image: item.image,
    isImportant: item.isImportant, publishedAt: item.publishedAt,
  };
}

/** The first important item — the hero on page 1 of /news. */
export function pickHero(items: NewsItem[]): NewsItem | null {
  return items.find((item) => item.isImportant) ?? null;
}

export function relatedNews<T extends { id: string }>(items: T[], currentId: string, limit = 3): T[] {
  return items.filter((item) => item.id !== currentId).slice(0, limit);
}

export function newsPath(id: string): string {
  return `/news/${encodeURIComponent(id)}`;
}

export function newsUrl(id: string): string {
  return `${SITE_URL}${newsPath(id)}`;
}

export function newsJsonLd(item: NewsItem): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title.slice(0, 110),
    description: item.summary || item.title,
    url: newsUrl(item.id),
    mainEntityOfPage: newsUrl(item.id),
    ...(item.image ? { image: [item.image] } : {}),
    ...(item.publishedAt ? { datePublished: item.publishedAt } : {}),
    publisher: { "@type": "Organization", name: "نادي الأنصار", logo: { "@type": "ImageObject", url: `${SITE_URL}/images/logo.svg` } },
  };
}

export function newsSitemapEntries(items: NewsItem[], now: Date): MetadataRoute.Sitemap {
  return items.map((item) => ({
    url: newsUrl(item.id),
    lastModified: item.publishedAt ? new Date(item.publishedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}
