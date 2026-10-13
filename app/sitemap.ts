import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/catalog";
import { fetchTicketedMatches } from "@/lib/match-data";
import { matchSitemapEntries, type TicketedMatch } from "@/lib/matches";
import { buildSitemap } from "@/lib/product-seo";
import type { Product } from "@/lib/types";

export const revalidate = 3600;

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
  const now = new Date();
  return [...buildSitemap(products, now), ...matchSitemapEntries(matches, now)];
}
