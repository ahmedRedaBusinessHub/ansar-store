import test from "node:test";
import assert from "node:assert/strict";
import { formatPublishedDate, listHref, parsePage, readPageMeta } from "../lib/content";

test("parsePage accepts 1..1000 and falls back to 1", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage(["2", "5"]), 2);
  assert.equal(parsePage("1000"), 1000);
  for (const bad of ["0", "-2", "abc", "2.5", "99999", "", " 2", "1e3"]) assert.equal(parsePage(bad), 1, bad);
});

test("listHref omits page 1 and empty values", () => {
  assert.equal(listHref("/gallery", { category: "TRAINING", page: 2 }), "/gallery?category=TRAINING&page=2");
  assert.equal(listHref("/news", { page: 1 }), "/news");
  assert.equal(listHref("/videos", { category: undefined, page: 3 }), "/videos?page=3");
  assert.equal(listHref("/gallery", { category: "" }), "/gallery");
});

test("readPageMeta trusts only non-negative integers", () => {
  assert.deepEqual(readPageMeta({ page: 2, totalCount: 30, pagesCount: 3 }, 2, 12), { page: 2, pagesCount: 3, totalCount: 30 });
  assert.deepEqual(readPageMeta(null, 1, 5), { page: 1, pagesCount: 1, totalCount: 5 });
  assert.deepEqual(readPageMeta({ pagesCount: -1, totalCount: "x" }, 1, 0), { page: 1, pagesCount: 1, totalCount: 0 });
  assert.deepEqual(readPageMeta({ pagesCount: 0, totalCount: 0 }, 1, 0), { page: 1, pagesCount: 0, totalCount: 0 });
});

test("formatPublishedDate shows the Riyadh calendar day", () => {
  const text = formatPublishedDate("2026-10-14T21:30:00.000Z"); // 00:30 on the 15th in Riyadh
  assert.match(text, /15/);
  assert.match(text, /أكتوبر/);
  assert.match(text, /2026/);
  assert.equal(formatPublishedDate(null), "");
});
