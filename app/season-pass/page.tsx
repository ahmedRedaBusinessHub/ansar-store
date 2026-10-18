import type { Metadata } from "next";
import SeasonPassPage from "@/components/season-pass-page";
import { readStore } from "@/lib/catalog";
import { STORE_NAME } from "@/lib/product-seo";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `التذكرة الموسمية | ${STORE_NAME}`,
  description: "احصل على تذكرتك الموسمية لمباريات الأنصار على أرضه، واختر مقعدك وادفع إلكترونيًا.",
  alternates: { canonical: "/season-pass" },
};

// Tiers, prices and availability are fetched on the client (always fresh); this page only renders the shell.
export default async function Page() {
  return <SeasonPassPage store={await readStore()} />;
}
