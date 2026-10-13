import type { Metadata } from "next";
import TicketsPage from "@/components/tickets-page";
import { readStore } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تذاكري | متجر الأنصار", robots: { index: false, follow: false } };

export default async function Page() {
  return <TicketsPage store={await readStore()} />;
}
