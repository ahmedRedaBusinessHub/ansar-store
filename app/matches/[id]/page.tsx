import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MatchPage from "@/components/match-page";
import { readStore } from "@/lib/catalog";
import { fetchMatchDetail } from "@/lib/match-data";
import { isMatchId, isPastMatch, matchDescription, matchJsonLd, matchPath, matchTitle, matchUrl } from "@/lib/matches";
import { jsonLdScript, STORE_NAME } from "@/lib/product-seo";

// ISR for the static part (teams, date, stadium). Sales state and sections are fetched fresh in the browser.
export const revalidate = 60;
const CACHE = { revalidate };
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = isMatchId(id) ? await fetchMatchDetail(id, CACHE).catch(() => null) : null;
  if (!match) return { title: `المباراة غير متاحة | ${STORE_NAME}`, robots: { index: false, follow: false } };
  const title = matchTitle(match);
  const description = matchDescription(match);
  return {
    title: `${title} | ${STORE_NAME}`,
    description,
    alternates: { canonical: matchPath(match.id) },
    // og:image comes from ./opengraph-image.tsx (Next adds it automatically).
    openGraph: { type: "website", url: matchUrl(match.id), siteName: STORE_NAME, locale: "ar_SA", title, description },
    twitter: { card: "summary_large_image", title, description },
    ...(isPastMatch(match) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!isMatchId(id)) notFound();
  const [store, match] = await Promise.all([readStore(CACHE), fetchMatchDetail(id, CACHE)]); // a throw → error.tsx
  if (!match) notFound();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(matchJsonLd(match)) }} />
    <MatchPage store={store} match={match} />
  </>;
}
