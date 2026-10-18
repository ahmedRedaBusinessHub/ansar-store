import type { Metadata } from "next";
import { NewsPage, type NewsPageData } from "@/components/news-page";
import { SitePage } from "@/components/site-page";
import { readStore } from "@/lib/catalog";
import { parsePage } from "@/lib/content";
import { pickHero } from "@/lib/news";
import { fetchNewsPage } from "@/lib/news-data";
import { STORE_NAME } from "@/lib/product-seo";

export const revalidate = 300;
const CACHE = { revalidate };

export const metadata: Metadata = {
  title: `أخبار الأنصار | ${STORE_NAME}`,
  description: "آخر أخبار نادي الأنصار: المباريات والتدريبات والفعاليات.",
  alternates: { canonical: "/news" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function loadNews(page: number): Promise<NewsPageData> {
  try {
    const list = await fetchNewsPage(page, CACHE);
    const important = page === 1
      ? await fetchNewsPage(1, { ...CACHE, important: true, perPage: 5 }).then((result) => result.items, () => [])
      : [];
    const hero = page === 1 ? pickHero(important) : null;
    return {
      hero,
      important,
      items: hero ? list.items.filter((item) => item.id !== hero.id) : list.items,
      page: list.page,
      pagesCount: list.pagesCount,
    };
  } catch {
    return null; // web-api down: the page still renders with a retry message
  }
}

export default async function Page({ searchParams }: Props) {
  const page = parsePage((await searchParams).page);
  const [store, data] = await Promise.all([readStore(CACHE), loadNews(page)]); // readStore throw → error.tsx
  return <SitePage store={store}><NewsPage data={data} /></SitePage>;
}
