import { z } from "zod";
import { toProduct } from "./adapter";
import { readSite } from "./site";
import { upstream } from "./upstream";
import type { Product, StoreData } from "./types";

const CACHE_MS = 60_000;
const PER_PAGE = 50;
const MAX_PAGES = 20;
let cache: { at: number; products: Product[] } | null = null;

export function resetCatalogCache(): void {
  cache = null;
}

/** Every REGULAR product from web-api. Invitation tickets are app-only and never sold on the web. */
export async function fetchProducts(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.products;
  try {
    const products: Product[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, meta } = await upstream<unknown[]>(`/api/v2/store?page=${page}&perPage=${PER_PAGE}&sort=created_at&order=desc`);
      for (const row of Array.isArray(data) ? data : []) {
        const product = toProduct(row);
        if (product && product.productType === "REGULAR") products.push(product);
      }
      const pages = (meta as { pagesCount?: unknown } | null)?.pagesCount;
      if (typeof pages !== "number" || page >= pages) break;
    }
    cache = { at: Date.now(), products };
    return products;
  } catch (error) {
    if (cache) return cache.products;
    throw error;
  }
}

export async function readStore(): Promise<StoreData> {
  const [site, products] = await Promise.all([readSite(), fetchProducts()]);
  return { ...site, categories: [{ id: "all", label: "جميع المنتجات" }], products };
}

export class CatalogQueryError extends Error {
  constructor() {
    super("Invalid query parameters");
    this.name = "CatalogQueryError";
  }
}

const integerParam = (max: number) => z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().min(1).max(max));
const querySchema = z.object({
  category: z.string().regex(/^[a-z0-9-]{1,40}$/).default("all"),
  q: z.string().trim().max(200).default(""),
  sort: z.enum(["featured", "price-asc", "price-desc"]).default("featured"),
  page: integerParam(10_000).default(1),
  limit: integerParam(48).default(24),
});

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
}

export function queryProducts(products: Product[], params: URLSearchParams): {
  products: Product[]; total: number; page: number; pages: number;
} {
  const input: Record<string, string> = {};
  for (const key of ["category", "q", "sort", "page", "limit"]) {
    const values = params.getAll(key);
    if (values.length > 1) throw new CatalogQueryError();
    if (values.length === 1) input[key] = values[0];
  }
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) throw new CatalogQueryError();
  const { category, q, sort, page, limit } = parsed.data;
  const terms = normalizeSearch(q).split(/\s+/).filter(Boolean);
  const matching = products.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    const searchable = normalizeSearch(`${product.name} ${product.subtitle} ${product.description}`);
    return terms.every((term) => searchable.includes(term));
  });
  if (sort !== "featured") matching.sort((a, b) => (sort === "price-asc" ? a.price - b.price : b.price - a.price));
  const total = matching.length;
  const pages = Math.ceil(total / limit);
  return { products: page > pages ? [] : matching.slice((page - 1) * limit, page * limit), total, page, pages };
}

export function findProduct(products: Product[], id: string): Product | undefined {
  return products.find((product) => product.id === id);
}
