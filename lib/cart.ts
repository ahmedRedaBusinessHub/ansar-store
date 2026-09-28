import type { CartItem, Product, SiteContent } from "./types";

export const MAX_PER_PRODUCT = 10;

const round = (value: number) => Math.round(value * 100) / 100;

export function cartKey(item: Pick<CartItem, "id" | "optionIds">): string {
  return `${item.id}|${item.optionIds.join(",")}`;
}

export function unitPrice(product: Product, optionIds: string[]): number {
  let total = product.price;
  for (const group of product.optionGroups) {
    for (const option of group.options) if (optionIds.includes(option.id)) total += option.extra;
  }
  return round(total);
}

export function productPriceRange(product: Product): { minimum: number; maximum: number; variable: boolean } {
  let minimum = product.price;
  let maximum = product.price;
  for (const group of product.optionGroups) {
    const extras = group.options.map((option) => option.extra);
    if (group.required && extras.length > 0) minimum += Math.min(...extras);
    if (extras.length > 0) maximum += Math.max(group.required ? Math.min(...extras) : 0, ...extras);
  }
  minimum = round(minimum);
  maximum = round(maximum);
  return { minimum, maximum, variable: maximum > minimum };
}

/** Returns the sorted option ids when the choice is complete and valid for this product, else null. */
export function validOptionIds(product: Product, optionIds: unknown): string[] | null {
  if (!Array.isArray(optionIds) || !optionIds.every((id) => typeof id === "string")) return null;
  const chosen = new Set<string>();
  for (const group of product.optionGroups) {
    const picked = group.options.filter((option) => optionIds.includes(option.id));
    if (picked.length > 1) return null;
    if (group.required && group.options.length > 0 && picked.length === 0) return null;
    if (picked[0]) chosen.add(picked[0].id);
  }
  if (chosen.size !== new Set(optionIds).size) return null;
  return [...chosen].sort();
}

export function normalizeCart(value: unknown, products: Product[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  const catalog = new Map(products.map((product) => [product.id, product]));
  const lines = new Map<string, CartItem>();
  const used = new Map<string, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, optionIds, quantity } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) continue;
    const product = catalog.get(id);
    if (!product) continue;
    const ids = validOptionIds(product, optionIds);
    if (!ids) continue;
    const already = used.get(id) ?? 0;
    const added = Math.min(quantity, MAX_PER_PRODUCT - already);
    if (added <= 0) continue;
    const key = cartKey({ id, optionIds: ids });
    const previous = lines.get(key);
    if (previous) previous.quantity += added;
    else lines.set(key, { id, optionIds: ids, quantity: added });
    used.set(id, already + added);
  }
  return [...lines.values()];
}

export function cartTotals(cart: CartItem[], products: Product[], shipping: SiteContent["shipping"]): {
  subtotal: number; shipping: number; total: number;
} {
  const normalized = normalizeCart(cart, products);
  const catalog = new Map(products.map((product) => [product.id, product]));
  const subtotal = round(normalized.reduce((sum, item) => {
    const product = catalog.get(item.id);
    return product ? sum + unitPrice(product, item.optionIds) * item.quantity : sum;
  }, 0));
  const fee = normalized.length === 0 || subtotal >= shipping.freeAbove ? 0 : shipping.fee;
  return { subtotal, shipping: fee, total: round(subtotal + fee) };
}
