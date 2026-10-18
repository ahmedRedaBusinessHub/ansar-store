"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Product, StoreData } from "@/lib/types";
import { AppBanner } from "./app-banner";
import { ProductDetail } from "./product-detail";
import { StoreShell } from "./store-shell";
import "./product-detail.css";

/** Client half of /products/[id]. The server half (metadata, JSON-LD, not-found) is app/products/[id]/page.tsx. */
export default function ProductPage({ store, product }: { store: StoreData; product: Product }) {
  const [query, setQuery] = useState("");
  return <StoreShell
    store={store}
    nav={{
      onShopAll: () => window.location.assign("/#collection"),
      onFavorites: () => window.location.assign("/?favorites=1#collection"),
      storyHref: "/#our-story",
      isShopAllActive: true,
    }}
    search={{
      query,
      onQueryChange: setQuery,
      onSubmit: () => window.location.assign(`/?q=${encodeURIComponent(query.trim())}#collection`),
    }}
  >
    {(api) => <main id="main-content" className="pd-main">
      <AppBanner productId={product.id} />
      <nav className="pd-breadcrumb" aria-label="مسار التنقل"><a href="/">المتجر</a><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
      <ProductDetail product={product} api={api} />
      <p className="pd-back"><a href="/#collection">العودة إلى المتجر <ArrowLeft size={17} /></a></p>
    </main>}
  </StoreShell>;
}
