import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET as getStore } from "../app/api/store/route";
import { GET as getProducts } from "../app/api/products/route";
import { GET as getProduct } from "../app/api/products/[id]/route";
import { resetCatalogCache } from "../lib/catalog";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const row = (id: string, name: string, price: string, product_type = "REGULAR") => ({
  id, name_ar: name, name_en: name, description_ar: "", image_url: null, price, product_type,
  created_at: "2026-09-01T00:00:00.000Z", images: [], attribute_groups: [],
});
const page1 = [row("11111111-1111-4111-8111-111111111111", "قميص", "249.00"), row("99999999-9999-4999-8999-999999999999", "تذكرة", "50.00", "INVITATION_TICKET")];
const page2 = [row("22222222-2222-4222-8222-222222222222", "وشاح", "79.90")];

function mockStore() {
  return mock.method(globalThis, "fetch", async (url: string) => {
    const u = new URL(url);
    assert.equal(u.pathname, "/api/v2/store");
    const page = Number(u.searchParams.get("page"));
    return Response.json({ data: page === 1 ? page1 : page2, meta: { page, totalCount: 3, pagesCount: 2 }, error: null });
  });
}

test("GET /api/store merges site content with every REGULAR product from all pages", async () => {
  resetCatalogCache();
  const fetchMock = mockStore();
  try {
    const response = await getStore();
    assert.equal(response.status, 200);
    const store = await response.json();
    assert.deepEqual(store.products.map((p: { name: string }) => p.name), ["قميص", "وشاح"]);
    assert.deepEqual(store.categories, [{ id: "all", label: "جميع المنتجات" }]);
    assert.equal(typeof store.hero.title, "string");
    assert.equal(fetchMock.mock.callCount(), 2);
    await getStore();                                   // cached for 60 s
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally { fetchMock.mock.restore(); }
});

test("GET /api/products and /api/products/{id}", async () => {
  resetCatalogCache();
  const fetchMock = mockStore();
  try {
    const list = await getProducts(new Request("http://shop.test/api/products?sort=price-asc"));
    assert.deepEqual((await list.json()).products.map((p: { price: number }) => p.price), [79.9, 249]);
    assert.equal((await getProducts(new Request("http://shop.test/api/products?limit=500"))).status, 400);
    const one = await getProduct(new Request("http://shop.test/api/products/x"), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    assert.equal((await one.json()).name, "وشاح");
    const missing = await getProduct(new Request("http://shop.test/api/products/x"), { params: Promise.resolve({ id: "99999999-9999-4999-8999-999999999999" }) });
    assert.equal(missing.status, 404);                  // invitation tickets are never sold on the web
    assert.deepEqual(await missing.json(), { error: "not_found" });
  } finally { fetchMock.mock.restore(); }
});

test("web-api down with an empty cache → 503 upstream_unavailable, no details leaked", async () => {
  resetCatalogCache();
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new TypeError("connect ECONNREFUSED 127.0.0.1:3000"); });
  try {
    for (const response of [await getStore(), await getProducts(new Request("http://shop.test/api/products"))]) {
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
    }
  } finally { fetchMock.mock.restore(); }
});
