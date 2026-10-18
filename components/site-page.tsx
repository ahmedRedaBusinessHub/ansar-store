"use client";

import { useState, type ReactNode } from "react";
import type { StoreData } from "@/lib/types";
import { StoreShell } from "./store-shell";
import "./content.css";

/**
 * Store chrome around the content pages (news and gallery). The page body stays a server
 * component: it arrives as `children`, so sanitised article HTML is never rebuilt on the client.
 */
export function SitePage({ store, children }: { store: StoreData; children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <StoreShell
    store={store}
    nav={{
      onShopAll: () => window.location.assign("/#collection"),
      onFavorites: () => window.location.assign("/?favorites=1#collection"),
      storyHref: "/#our-story",
      isShopAllActive: false,
    }}
    search={{
      query,
      onQueryChange: setQuery,
      onSubmit: () => window.location.assign(`/?q=${encodeURIComponent(query.trim())}#collection`),
    }}
  >
    {() => children}
  </StoreShell>;
}
