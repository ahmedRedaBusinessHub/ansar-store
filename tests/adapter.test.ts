import test from "node:test";
import assert from "node:assert/strict";
import { PLACEHOLDER_IMAGE, stripHtml, toOrderSummary, toProduct } from "../lib/adapter";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const row = {
  id: "11111111-1111-4111-8111-111111111111", name_ar: " قميص الفريق الأساسي ", name_en: "Home shirt",
  description_ar: "<p>قميص <strong>الأنصار</strong></p><p>قصة رياضية &amp; مريحة</p>", description_en: "",
  image_url: "/uploads/legacy.jpg", image_blurhash: null, price: "249.00", views: 3, product_type: "REGULAR",
  invitation_count: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z",
  images: [
    { id: "i2", image_url: "https://cdn.test/back.jpg", blurhash: "x", is_main: false, order: 1 },
    { id: "i1", image_url: "https://cdn.test/front.jpg", blurhash: "x", is_main: true, order: 0 },
    { id: "i3", image_url: "javascript:alert(1)", blurhash: "x", is_main: false, order: 2 },
  ],
  attribute_groups: [
    { id: "g-print", name_ar: "الطباعة", name_en: "Print", is_required: false, display_order: 2,
      options: [{ id: "o-name", value_ar: "طباعة الاسم", value_en: "Name", additional_price: "35.50", is_available: true, display_order: 0 }] },
    { id: "g-size", name_ar: "المقاس", name_en: "Size", is_required: true, display_order: 1,
      options: [
        { id: "o-xxl", value_ar: "XXL", value_en: "XXL", additional_price: "10.00", is_available: true, display_order: 3 },
        { id: "o-s", value_ar: "S", value_en: "S", additional_price: "0", is_available: true, display_order: 1 },
        { id: "o-m", value_ar: "M", value_en: "M", additional_price: "0", is_available: false, display_order: 2 },
      ] },
    { id: "g-empty", name_ar: "اللون", name_en: "Color", is_required: true, display_order: 0, options: [] },
  ],
};

test("toProduct maps a web-api row to the storefront Product", () => {
  assert.deepEqual(toProduct(row), {
    id: row.id, name: "قميص الفريق الأساسي", subtitle: "", category: "all", price: 249,
    image: "https://cdn.test/front.jpg", images: ["https://cdn.test/front.jpg", "https://cdn.test/back.jpg"],
    colors: [], description: "قميص الأنصار\nقصة رياضية & مريحة", details: [], productType: "REGULAR",
    optionGroups: [
      { id: "g-size", name: "المقاس", required: true, options: [{ id: "o-s", label: "S", extra: 0 }, { id: "o-xxl", label: "XXL", extra: 10 }] },
      { id: "g-print", name: "الطباعة", required: false, options: [{ id: "o-name", label: "طباعة الاسم", extra: 35.5 }] },
    ],
  });
});

test("toProduct falls back to the legacy image, then the placeholder, and rejects bad rows", () => {
  assert.deepEqual(toProduct({ ...row, images: [] })?.images, ["http://api.test/uploads/legacy.jpg"]);
  const bare = toProduct({ ...row, images: [], image_url: null });
  assert.equal(bare?.image, PLACEHOLDER_IMAGE);
  assert.deepEqual(bare?.images, [PLACEHOLDER_IMAGE]);
  assert.equal(toProduct({ ...row, id: "not-a-uuid" }), null);
  assert.equal(toProduct({ ...row, price: "abc" }), null);
  assert.equal(toProduct(null), null);
});

test("stripHtml returns plain text", () => {
  assert.equal(stripHtml("a<br>b<script>x</script>&lt;i&gt;"), "a\nbx<i>");
  assert.equal(stripHtml(""), "");
});

test("toOrderSummary maps an order row", () => {
  const order = {
    id: "44444444-4444-4444-8444-444444444444", payment_status: "UNPAID", fulfillment_status: "PENDING",
    tracking_number: null, delivery_address: "المدينة المنورة، حي قباء", total_price: "284.50",
    created_at: "2026-09-27T10:00:00.000Z",
    order_items: [{ id: "oi1", quantity: 1, unit_price: "294.50", total_price: "294.50", item_name_ar: "قميص",
      item_image_url: "/uploads/front.jpg",
      attributes: [{ group_name_ar: "المقاس", value_ar: "XXL", additional_price: "10.00" }] }],
  };
  assert.deepEqual(toOrderSummary(order), {
    id: order.id, createdAt: order.created_at, total: 284.5, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING",
    trackingNumber: null, deliveryAddress: "المدينة المنورة، حي قباء",
    items: [{ name: "قميص", image: "http://api.test/uploads/front.jpg", quantity: 1, unitPrice: 294.5, total: 294.5, options: ["المقاس: XXL"] }],
  });
  assert.equal(toOrderSummary({ id: "x" }), null);
});
