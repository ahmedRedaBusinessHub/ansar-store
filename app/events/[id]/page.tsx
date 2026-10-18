import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventPage from "@/components/event-page";
import { readStore } from "@/lib/catalog";
import { fetchEventInfo } from "@/lib/event-data";
import { eventJsonLd, eventPath, eventUrl, isEventId, isPastEvent } from "@/lib/events";
import { jsonLdScript, STORE_NAME } from "@/lib/product-seo";

// ISR for the static part (title, date, image). Availability and the shopper's booking load fresh in the browser.
export const revalidate = 60;
const CACHE = { revalidate };
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const info = isEventId(id) ? await fetchEventInfo(id, null, CACHE).catch(() => null) : null;
  if (!info) return { title: `الفعالية غير متاحة | ${STORE_NAME}`, robots: { index: false, follow: false } };
  const { event } = info;
  const description = event.descriptionAr.slice(0, 160) || event.titleAr;
  return {
    title: `${event.titleAr} | ${STORE_NAME}`,
    description,
    alternates: { canonical: eventPath(event.id) },
    openGraph: {
      type: "website", url: eventUrl(event.id), siteName: STORE_NAME, locale: "ar_SA", title: event.titleAr, description,
      ...(event.image ? { images: [{ url: event.image }] } : {}),
    },
    twitter: { card: event.image ? "summary_large_image" : "summary", title: event.titleAr, description },
    ...(isPastEvent(event.date) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!isEventId(id)) notFound();
  const [store, info] = await Promise.all([readStore(CACHE), fetchEventInfo(id, null, CACHE)]);
  if (!info) notFound();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(eventJsonLd(info.event)) }} />
    <EventPage store={store} initial={info} />
  </>;
}
