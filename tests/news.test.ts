import test from "node:test";
import assert from "node:assert/strict";
import {
  excerpt, isNewsId, newsJsonLd, newsPath, newsSitemapEntries, pickHero, plainText,
  readingMinutes, relatedNews, toNewsCard, toNewsItem,
} from "../lib/news";
import { jsonLdScript } from "../lib/product-seo";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const row = {
  id: 4521, title_ar: "فوز الأنصار &#8211; الجولة الأولى", title_en: "x",
  description_ar: "<p>نص <strong>الخبر</strong></p>", description_en: "x",
  image_url: "/uploads/news/a.jpg", image_blurhash: null, is_important: true,
  created_at: "2026-10-14T21:30:00.000Z",
};

test("toNewsItem maps a WordPress-sourced row", () => {
  assert.deepEqual(toNewsItem(row), {
    id: "4521", title: "فوز الأنصار – الجولة الأولى", html: "<p>نص <strong>الخبر</strong></p>",
    summary: "نص الخبر", image: "http://api.test/uploads/news/a.jpg", isImportant: true,
    publishedAt: "2026-10-14T21:30:00.000Z",
  });
});

test("toNewsItem drops unusable rows and unsafe values", () => {
  assert.equal(toNewsItem({ ...row, title_ar: "  <b></b> " }), null);
  assert.equal(toNewsItem({ ...row, id: "../etc" }), null);
  assert.equal(toNewsItem({ id: "x" }), null);
  assert.equal(toNewsItem(null), null);
  const item = toNewsItem({ ...row, image_url: "javascript:alert(1)", is_important: "yes", created_at: "not a date", description_ar: null });
  assert.equal(item?.image, null);
  assert.equal(item?.isImportant, false);
  assert.equal(item?.publishedAt, null);
  assert.equal(item?.html, "");
  assert.equal(item?.summary, "");
});

test("plainText, excerpt and reading time", () => {
  assert.equal(plainText("<p>A&nbsp;&amp;&#1576;</p>"), "A &ب");
  assert.equal(excerpt("<p>a   b</p><p>c</p>"), "a b c");
  const long = excerpt(`<p>${"ا".repeat(300)}</p>`);
  assert.equal(long.length, 160);
  assert.ok(long.endsWith("…"));
  assert.equal(readingMinutes(""), 1);
  assert.equal(readingMinutes(`<p>${"كلمة ".repeat(401)}</p>`), 3);
});

test("hero, related, ids and paths", () => {
  const a = toNewsItem({ ...row, id: "a", is_important: false })!;
  const b = toNewsItem({ ...row, id: "b", is_important: true })!;
  const c = toNewsItem({ ...row, id: "c", is_important: true })!;
  assert.equal(pickHero([a, b, c])?.id, "b");
  assert.equal(pickHero([a]), null);
  assert.deepEqual(relatedNews([a, b, c], "b").map((item) => item.id), ["a", "c"]);
  assert.deepEqual(relatedNews([a, b, c], "x", 2).map((item) => item.id), ["a", "b"]);
  assert.equal(newsPath("4521"), "/news/4521");
  assert.equal(isNewsId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isNewsId("a/b"), false);
  assert.equal(isNewsId(""), false);
  assert.equal("html" in toNewsCard(a), false);
  assert.equal(toNewsCard(a).title, a.title);
});

test("JSON-LD cannot close its script tag; sitemap uses production URLs", () => {
  const item = toNewsItem({ ...row, title_ar: "a &lt;/script&gt; b" })!;
  assert.equal(item.title, "a </script> b");
  const ld = newsJsonLd(item);
  assert.equal(ld["@type"], "NewsArticle");
  assert.equal(ld.url, "https://store.alansar.sa/news/4521");
  assert.ok(!jsonLdScript(ld).includes("</script>"));
  const [entry] = newsSitemapEntries([item], new Date(0));
  assert.equal(entry.url, "https://store.alansar.sa/news/4521");
  assert.deepEqual(entry.lastModified, new Date("2026-10-14T21:30:00.000Z"));
});
