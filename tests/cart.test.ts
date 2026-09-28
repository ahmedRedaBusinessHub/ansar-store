import test from "node:test";
import assert from "node:assert/strict";
import { cartKey, cartTotals, normalizeCart, productPriceRange, unitPrice, validOptionIds, MAX_PER_PRODUCT } from "../lib/cart";
import type { Product } from "../lib/types";

const shirt: Product = {
  id: "11111111-1111-4111-8111-111111111111", name: "قميص", subtitle: "", category: "all", price: 249,
  image: "/images/placeholder.svg", images: ["/images/placeholder.svg"], colors: [], description: "", details: [],
  productType: "REGULAR",
  optionGroups: [
    { id: "g-size", name: "المقاس", required: true, options: [
      { id: "o-m", label: "M", extra: 0 }, { id: "o-xxl", label: "XXL", extra: 10 }] },
    { id: "g-print", name: "الطباعة", required: false, options: [{ id: "o-name", label: "طباعة الاسم", extra: 35.5 }] },
  ],
};
const scarf: Product = { ...shirt, id: "22222222-2222-4222-8222-222222222222", name: "وشاح", price: 79.9, optionGroups: [] };
const products = [shirt, scarf];
const shipping = { fee: 0, freeAbove: 0 };

test("unitPrice adds the extra of every chosen option", () => {
  assert.equal(unitPrice(shirt, ["o-name", "o-xxl"]), 294.5);
  assert.equal(unitPrice(shirt, ["o-m"]), 249);
  assert.equal(unitPrice(scarf, []), 79.9);
});

test("productPriceRange includes required option minimums and optional price variation", () => {
  assert.deepEqual(productPriceRange({
    ...shirt,
    price: 100,
    optionGroups: [
      { id: "size", name: "المقاس", required: true, options: [
        { id: "large", label: "كبير", extra: 20 },
        { id: "xlarge", label: "كبير جدًا", extra: 30 },
      ] },
      { id: "print", name: "الطباعة", required: false, options: [{ id: "name", label: "طباعة الاسم", extra: 15 }] },
    ],
  }), { minimum: 120, maximum: 145, variable: true });
  assert.deepEqual(productPriceRange({
    ...shirt,
    price: 100,
    optionGroups: [{ id: "size", name: "المقاس", required: true, options: [{ id: "large", label: "كبير", extra: 20 }] }],
  }), { minimum: 120, maximum: 120, variable: false });
  assert.deepEqual(productPriceRange(scarf), { minimum: 79.9, maximum: 79.9, variable: false });
});

test("validOptionIds requires one option per required group and rejects unknown or duplicate groups", () => {
  assert.deepEqual(validOptionIds(shirt, ["o-xxl", "o-name"]), ["o-name", "o-xxl"]);
  assert.equal(validOptionIds(shirt, ["o-name"]), null);          // required size missing
  assert.equal(validOptionIds(shirt, ["o-m", "o-xxl"]), null);    // two sizes
  assert.equal(validOptionIds(shirt, ["o-m", "nope"]), null);     // unknown id
  assert.equal(validOptionIds(shirt, "o-m"), null);               // not an array
  assert.deepEqual(validOptionIds(scarf, []), []);
});

test("normalizeCart drops invalid lines, merges equal variants and caps each product at 10", () => {
  const cart = normalizeCart([
    { id: shirt.id, optionIds: ["o-xxl", "o-name"], quantity: 3 },
    { id: shirt.id, optionIds: ["o-name", "o-xxl"], quantity: 2 },   // same variant, other order → merged
    { id: shirt.id, optionIds: ["o-m"], quantity: 100 },             // capped by the per-product limit
    { id: shirt.id, optionIds: [], quantity: 1 },                    // required group missing → dropped
    { id: "missing", optionIds: [], quantity: 1 },
    { id: scarf.id, optionIds: [], quantity: 0 },
    { id: scarf.id, optionIds: [], quantity: 2, price: 1 },
    "garbage",
  ], products);
  assert.deepEqual(cart, [
    { id: shirt.id, optionIds: ["o-name", "o-xxl"], quantity: 5 },
    { id: shirt.id, optionIds: ["o-m"], quantity: MAX_PER_PRODUCT - 5 },
    { id: scarf.id, optionIds: [], quantity: 2 },
  ]);
  assert.equal(normalizeCart("x", products).length, 0);
});

test("cartKey is stable and cartTotals uses option prices", () => {
  assert.equal(cartKey({ id: "a", optionIds: ["x", "y"] }), "a|x,y");
  const totals = cartTotals([{ id: shirt.id, optionIds: ["o-name", "o-xxl"], quantity: 2 }, { id: scarf.id, optionIds: [], quantity: 1 }], products, shipping);
  assert.deepEqual(totals, { subtotal: 668.9, shipping: 0, total: 668.9 });
  assert.deepEqual(cartTotals([], products, { fee: 25, freeAbove: 350 }), { subtotal: 0, shipping: 0, total: 0 });
  assert.equal(cartTotals([{ id: scarf.id, optionIds: [], quantity: 1 }], products, { fee: 25, freeAbove: 350 }).shipping, 25);
});
