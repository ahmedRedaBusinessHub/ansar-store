import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { readStore } from "@/lib/catalog";
import type { StoreData } from "@/lib/types";

// Rendered on the server so search engines see the catalogue. Refreshed at most once a minute,
// matching the 60s catalogue cache in lib/catalog.ts.
export const revalidate = 60;

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Page() {
  let store: StoreData | null = null;
  try {
    store = await readStore();
  } catch {
    store = null; // web-api unreachable: the client retries via /api/store
  }
  return <Storefront initialStore={store} />;
}
