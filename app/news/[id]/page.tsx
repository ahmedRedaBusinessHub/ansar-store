import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticle } from "@/components/news-article";
import { SitePage } from "@/components/site-page";
import { readStore } from "@/lib/catalog";
import { newsJsonLd, newsPath, newsUrl, relatedNews } from "@/lib/news";
import { fetchNewsItem, fetchNewsPage } from "@/lib/news-data";
import { jsonLdScript, STORE_NAME } from "@/lib/product-seo";

export const revalidate = 300;
const CACHE = { revalidate };
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchNewsItem(id, CACHE).catch(() => null);
  if (!item) return { title: `الخبر غير متاح | ${STORE_NAME}`, robots: { index: false, follow: false } };
  const description = item.summary || item.title;
  return {
    title: `${item.title} | ${STORE_NAME}`,
    description,
    alternates: { canonical: newsPath(item.id) },
    openGraph: {
      type: "article", url: newsUrl(item.id), siteName: STORE_NAME, locale: "ar_SA", title: item.title, description,
      ...(item.image ? { images: [item.image] } : {}),
      ...(item.publishedAt ? { publishedTime: item.publishedAt } : {}),
    },
    twitter: { card: item.image ? "summary_large_image" : "summary", title: item.title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [store, item] = await Promise.all([readStore(CACHE), fetchNewsItem(id, CACHE)]); // a throw → error.tsx
  if (!item) notFound();
  const latest = await fetchNewsPage(1, { ...CACHE, perPage: 4 }).then((result) => result.items, () => []);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(newsJsonLd(item)) }} />
    <SitePage store={store}><NewsArticle item={item} related={relatedNews(latest, item.id)} /></SitePage>
  </>;
}
