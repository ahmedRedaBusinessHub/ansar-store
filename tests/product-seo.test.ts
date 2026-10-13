import test from "node:test";
import assert from "node:assert/strict";
import {
  absoluteImageUrl, buildRobots, buildSitemap, formatSar, isProductId, jsonLdScript,
  productDescription, productJsonLd, productPath, productShareText, productUrl, SITE_URL,
} from "../lib/product-seo";
import type { Product } from "../lib/types";

const ID = "11111111-1111-4111-8111-111111111111";
const product: Product = {
  id: ID, name: "قميص الفريق الأساسي", subtitle: "", category: "all", price: 249,
  image: "https://app.alansar.sa/uploads/a.webp", images: ["https://app.alansar.sa/uploads/a.webp", "/images/placeholder.svg"],
  colors: [], optionGroups: [], description: "قميص   أخضر\nللموسم", details: [], productType: "REGULAR",
};

test("isProductId accepts UUIDs only", () => {
  assert.equal(isProductId(ID), true);
  assert.equal(isProductId(ID.toUpperCase()), true);
  for (const bad of ["", "abc", "../etc/passwd", `${ID}x`, `/${ID}`]) assert.equal(isProductId(bad), false, bad);
});

test("product paths and URLs use the production origin", () => {
  assert.equal(SITE_URL, "https://store.alansar.sa");
  assert.equal(productPath(ID), `/products/${ID}`);
  assert.equal(productUrl(ID), `https://store.alansar.sa/products/${ID}`);
  assert.equal(absoluteImageUrl("/images/placeholder.svg"), "https://store.alansar.sa/images/placeholder.svg");
  assert.equal(absoluteImageUrl("https://cdn.example/x.webp"), "https://cdn.example/x.webp");
});

test("prices and share text are locale-independent", () => {
  assert.equal(formatSar(249), "249");
  assert.equal(formatSar(79.9), "79.90");
  assert.equal(productShareText({ name: "وشاح الأنصار", price: 79.9 }), "وشاح الأنصار — 79.90 ر.س");
});

test("description collapses whitespace, falls back, and caps at 160 chars", () => {
  assert.equal(productDescription(product), "قميص أخضر للموسم");
  assert.equal(productDescription({ name: "وشاح", description: "   " }), "وشاح من متجر الأنصار.");
  const long = productDescription({ name: "x", description: "ا".repeat(200) });
  assert.equal(long.length, 160);
  assert.ok(long.endsWith("…"));
});

test("JSON-LD describes the product offer and omits rating when there is none", () => {
  const data = productJsonLd(product) as Record<string, any>;
  assert.equal(data["@type"], "Product");
  assert.equal(data.name, product.name);
  assert.deepEqual(data.image, ["https://app.alansar.sa/uploads/a.webp", "https://store.alansar.sa/images/placeholder.svg"]);
  assert.equal(data.offers.price, "249.00");
  assert.equal(data.offers.priceCurrency, "SAR");
  assert.equal(data.offers.url, productUrl(ID));
  assert.equal(data.offers.availability, "https://schema.org/InStock");
  assert.equal("aggregateRating" in data, false);
  const rated = productJsonLd({ ...product, rating: { average: 4.5, count: 12 } }) as Record<string, any>;
  assert.deepEqual(rated.aggregateRating, { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12 });
});

test("jsonLdScript cannot close the script tag", () => {
  const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
  assert.equal(out.includes("<"), false);
  assert.deepEqual(JSON.parse(out), { name: "</script><script>alert(1)</script>" });
});

test("sitemap lists home plus REGULAR products only", () => {
  const when = new Date("2026-10-12T00:00:00.000Z");
  const map = buildSitemap([product, { ...product, id: "22222222-2222-4222-8222-222222222222", productType: "INVITATION_TICKET" }], when);
  assert.deepEqual(map.map((entry) => entry.url), ["https://store.alansar.sa/", productUrl(ID)]);
  assert.equal(map[0].lastModified, when);
});

test("robots allows the store and blocks private paths", () => {
  const robots = buildRobots();
  assert.deepEqual(robots.rules, [{ userAgent: "*", allow: "/", disallow: ["/api/", "/orders", "/checkout/", "/tickets"] }]);
  assert.equal(robots.sitemap, "https://store.alansar.sa/sitemap.xml");
});
