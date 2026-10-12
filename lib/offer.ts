import type { Product } from "./types";

export type Offer = { original: number; percentOff: number };

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The struck-through "price before offer" for the price currently on screen.
 *
 * Options add the same extra to both prices, so the original moves by
 * (shownPrice - product.price). Same rules as the mobile `getOfferInfo`:
 * no offer unless original > shown, shown >= 0, and the floored saving is
 * at least 1%. Floor, never round — never overstate a saving. The percent is
 * computed as (diff * 100) / original plus a tiny epsilon, because
 * `1 - 80/100` is 0.19999999999999996 in floating point and would floor to 19.
 */
export function offerFor(product: Pick<Product, "price" | "originalPrice">, shownPrice: number): Offer | null {
  if (product.originalPrice === undefined) return null;
  if (!Number.isFinite(shownPrice) || shownPrice < 0) return null;
  const original = round(product.originalPrice + (shownPrice - product.price));
  if (!(original > shownPrice)) return null;
  const percentOff = Math.floor(((original - shownPrice) * 100) / original + 1e-9);
  if (percentOff < 1) return null;
  return { original, percentOff };
}
