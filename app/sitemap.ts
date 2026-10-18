import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/catalog";
import { fetchBookableEvents } from "@/lib/event-data";
import { eventSitemapEntries, type EventSummary } from "@/lib/events";
import { fetchTicketedMatches } from "@/lib/match-data";
import { matchSitemapEntries, type TicketedMatch } from "@/lib/matches";
import { newsSitemapEntries, type NewsItem } from "@/lib/news";
import { fetchNewsPage } from "@/lib/news-data";
import { buildSitemap, contentHubSitemap, SITE_URL } from "@/lib/product-seo";
import type { Product } from "@/lib/types";

export const revalidate = 3600;

const SITEMAP_NEWS = 50;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Product[] = [];
  try {
    products = await fetchProducts();
  } catch {
    products = []; // web-api down: still publish the home page
  }
  let matches: TicketedMatch[] = [];
  try {
    matches = await fetchTicketedMatches();
  } catch {
    matches = [];
  }
  let events: EventSummary[] = [];
  try {
    events = await fetchBookableEvents();
  } catch {
    events = [];
  }
  let news: NewsItem[] = [];
  try {
    news = (await fetchNewsPage(1, { perPage: SITEMAP_NEWS, revalidate })).items;
  } catch {
    news = []; // a failed news fetch drops only the article entries
  }
  const now = new Date();
  const seasonPass: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/season-pass`, lastModified: now, changeFrequency: "weekly", priority: 0.7 }];
  return [
    ...buildSitemap(products, now),
    ...matchSitemapEntries(matches, now),
    ...eventSitemapEntries(events, now),
    ...seasonPass,
    ...contentHubSitemap(now),
    ...newsSitemapEntries(news, now),
  ];
}
