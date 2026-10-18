import type { MetadataRoute } from "next";
import type { Product } from "./types";

/** Canonical public origin. Links, canonical tags and the sitemap always point at production, even in dev. */
export const SITE_URL = "https://store.alansar.sa";
export const STORE_NAME = "متجر الأنصار";
export const IOS_APP_ID = "6761245973";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DESCRIPTION_MAX = 160;

export function isProductId(value: string): boolean {
  return UUID.test(value);
}

export function productPath(id: string): string {
  return `/products/${id}`;
}

export function productUrl(id: string): string {
  return `${SITE_URL}${productPath(id)}`;
}

/** Site-relative assets ("/images/…") become absolute; absolute URLs pass through. */
export function absoluteImageUrl(src: string): string {
  return src.startsWith("/") ? `${SITE_URL}${src}` : src;
}

/** 249 → "249", 79.9 → "79.90". Locale-independent so tests and share text are stable. */
export function formatSar(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function productShareText(product: Pick<Product, "name" | "price">): string {
  return `${product.name} — ${formatSar(product.price)} ر.س`;
}

export function productDescription(product: Pick<Product, "name" | "description">): string {
  const text = product.description.replace(/\s+/g, " ").trim();
  if (!text) return `${product.name} من ${STORE_NAME}.`;
  if (text.length <= DESCRIPTION_MAX) return text;
  return `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

export function productJsonLd(product: Product): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map(absoluteImageUrl),
    description: productDescription(product),
    sku: product.id,
    brand: { "@type": "Brand", name: "نادي الأنصار" },
    offers: {
      "@type": "Offer",
      url: productUrl(product.id),
      priceCurrency: "SAR",
      price: product.price.toFixed(2),
      // The catalogue carries no stock data and lists only sellable products.
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(product.rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count } }
      : {}),
  };
}

/** Serialises JSON-LD for a <script> tag. "<" is escaped so product text can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildSitemap(products: Product[], lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "daily", priority: 1 },
    ...products
      .filter((product) => product.productType === "REGULAR")
      .map((product) => ({ url: productUrl(product.id), lastModified, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}

/** News and media hub list pages (spec 2026-10-14). Article URLs come from newsSitemapEntries. */
export function contentHubSitemap(lastModified: Date): MetadataRoute.Sitemap {
  return ["/news", "/gallery"].map((path) => ({
    url: `${SITE_URL}${path}`, lastModified, changeFrequency: "daily" as const, priority: 0.7,
  }));
}

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/orders", "/checkout/", "/tickets"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
