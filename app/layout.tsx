import type { Metadata } from "next";
import { SITE_URL } from "@/lib/product-seo";
import "./globals.css";

// Indexable by default (spec 2026-10-12 D3). Private pages (orders, checkout, /open, not-found) set noindex themselves.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "متجر الأنصار | من المدينة، بكل فخر",
  description: "اكتشف مجموعة نادي الأنصار لموسم 2026/2027. أطقم للكبار والصغار بروح المدينة.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
