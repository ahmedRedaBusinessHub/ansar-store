import type { Metadata } from "next";
import EventsPage from "@/components/events-page";
import { readStore } from "@/lib/catalog";
import { fetchBookableEvents } from "@/lib/event-data";
import type { EventSummary } from "@/lib/events";
import { STORE_NAME } from "@/lib/product-seo";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `الفعاليات | ${STORE_NAME}`,
  description: "احجز مكانك في فعاليات نادي الأنصار وادفع إلكترونيًا، وتصلك التذاكر فورًا.",
  alternates: { canonical: "/events" },
};

export default async function Page() {
  const store = await readStore();
  let events: EventSummary[] = [];
  try {
    events = await fetchBookableEvents({ revalidate });
  } catch {
    events = [];
  }
  return <EventsPage store={store} events={events} />;
}
