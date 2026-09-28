import test from "node:test";
import assert from "node:assert/strict";
import { CatalogQueryError, findProduct, queryProducts } from "../lib/catalog";
import type { Product } from "../lib/types";

const base: Omit<Product, "id" | "name" | "price" | "description"> = {
  subtitle: "", category: "all", image: "/images/placeholder.svg", images: ["/images/placeholder.svg"],
  colors: [], optionGroups: [], details: [], productType: "REGULAR",
};
const products: Product[] = [
  { ...base, id: "11111111-1111-4111-8111-111111111111", name: "قميص الفريق الأساسي", price: 249, description: "أخضر" },
  { ...base, id: "22222222-2222-4222-8222-222222222222", name: "وشاح الأنصار", price: 79.9, description: "إكسسوار" },
  { ...base, id: "33333333-3333-4333-8333-333333333333", name: "قميص الإحماء", price: 120, description: "تدريب" },
];

test("search ignores Arabic diacritics and hamza forms", () => {
  const result = queryProducts(products, new URLSearchParams({ q: "قَميص" }));
  assert.deepEqual(result.products.map((p) => p.name), ["قميص الفريق الأساسي", "قميص الإحماء"]);
  assert.equal(queryProducts(products, new URLSearchParams({ q: "الانصار" })).total, 1);
});

test("sorting and pagination", () => {
  assert.deepEqual(queryProducts(products, new URLSearchParams({ sort: "price-asc" })).products.map((p) => p.price), [79.9, 120, 249]);
  const page = queryProducts(products, new URLSearchParams({ limit: "2", page: "2" }));
  assert.deepEqual({ total: page.total, pages: page.pages, count: page.products.length }, { total: 3, pages: 2, count: 1 });
  assert.equal(queryProducts(products, new URLSearchParams({ category: "all" })).total, 3);
});

test("invalid queries throw CatalogQueryError; findProduct matches by id", () => {
  for (const q of ["limit=500", "page=0", "sort=cheap", "category=../x", "q=a&q=b"]) {
    assert.throws(() => queryProducts(products, new URLSearchParams(q)), CatalogQueryError);
  }
  assert.equal(findProduct(products, products[1].id)?.name, "وشاح الأنصار");
  assert.equal(findProduct(products, "nope"), undefined);
});
