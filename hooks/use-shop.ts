"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cartKey, cartTotals, MAX_PER_PRODUCT, normalizeCart, validOptionIds } from "../lib/cart";
import type { CartItem, Product, SiteContent } from "../lib/types";

// v2: cart lines are { id: uuid, optionIds, quantity }. v1 JSON-demo carts are ignored.
const CART_KEY = "ansar-store:cart:v2";
const WISHLIST_KEY = "ansar-store:wishlist:v2";

function readSaved(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw && raw.length <= 100_000 ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage denied: keep shopping in memory */ }
}

export function useShop(products: Product[], shipping: SiteContent["shipping"]) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const cartRef = useRef<CartItem[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    // Never normalise a saved cart against an empty catalog: that would wipe it.
    if (!hydrated.current && products.length === 0) return;
    const next = normalizeCart(hydrated.current ? cartRef.current : readSaved(CART_KEY), products);
    cartRef.current = next;
    setCart(next);
    const ids = new Set(products.map((product) => product.id));
    if (!hydrated.current) {
      const saved = readSaved(WISHLIST_KEY);
      setWishlist(Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string" && ids.has(id)))] : []);
    } else {
      setWishlist((current) => current.filter((id) => ids.has(id)));
    }
    hydrated.current = true;
    setReady(true);
  }, [products]);

  useEffect(() => { if (ready) save(CART_KEY, cart); }, [cart, ready]);
  useEffect(() => { if (ready) save(WISHLIST_KEY, wishlist); }, [wishlist, ready]);

  const commit = useCallback((next: CartItem[]) => {
    cartRef.current = next;
    setCart(next);
  }, []);

  const addItem = useCallback((id: string, optionIds: string[]) => {
    const product = products.find((item) => item.id === id);
    const ids = product ? validOptionIds(product, optionIds) : null;
    if (!hydrated.current || !product || !ids) return false;
    const current = normalizeCart(cartRef.current, products);
    const count = current.filter((item) => item.id === id).reduce((sum, item) => sum + item.quantity, 0);
    if (count >= MAX_PER_PRODUCT) return false;
    commit(normalizeCart([...current, { id, optionIds: ids, quantity: 1 }], products));
    return true;
  }, [products, commit]);

  const setQuantity = useCallback((key: string, quantity: number) => {
    if (!hydrated.current || !Number.isSafeInteger(quantity) || quantity < 0) return;
    const current = normalizeCart(cartRef.current, products);
    const next = current.map((item) => (cartKey(item) === key ? { ...item, quantity } : item)).filter((item) => item.quantity > 0);
    commit(normalizeCart(next, products));
  }, [products, commit]);

  const toggleWishlist = useCallback((id: string) => {
    if (!hydrated.current || !products.some((product) => product.id === id)) return;
    setWishlist((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }, [products]);

  const totals = useMemo(() => cartTotals(cart, products, shipping), [cart, products, shipping]);
  return { cart, wishlist, ready, totals, addItem, setQuantity, toggleWishlist };
}
