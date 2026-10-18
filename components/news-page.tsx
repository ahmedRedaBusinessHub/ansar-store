import { formatPublishedDate, listHref } from "@/lib/content";
import { newsPath, toNewsCard, type NewsItem } from "@/lib/news";
import { ContentUnavailable, Pager } from "./content-parts";
import { NewsCard } from "./news-card";
import { NewsTicker } from "./news-ticker";
import "./news.css";

/** null = web-api unreachable. */
export type NewsPageData = { hero: NewsItem | null; important: NewsItem[]; items: NewsItem[]; page: number; pagesCount: number } | null;

export function NewsPage({ data }: { data: NewsPageData }) {
  return <main id="main-content" className="ct-page section-shell">
    <span className="section-kicker">المركز الإعلامي</span>
    <h1>أخبار الأنصار<span className="heading-dot">.</span></h1>
    {data === null ? <ContentUnavailable retryHref="/news" /> : <>
      <NewsTicker items={data.important.map(toNewsCard)} />
      {data.hero && <a className="nw-hero" href={newsPath(data.hero.id)}>
        {data.hero.image && <img src={data.hero.image} alt="" />}
        <div className="nw-hero-body">
          <span className="nw-badge">خبر مهم</span>
          {data.hero.publishedAt && <time dateTime={data.hero.publishedAt}>{formatPublishedDate(data.hero.publishedAt)}</time>}
          <h2>{data.hero.title}</h2>
          {data.hero.summary && <p>{data.hero.summary}</p>}
        </div>
      </a>}
      {data.items.length === 0
        ? <div className="ct-empty"><h2>لا توجد أخبار هنا</h2>{data.page > 1 && <a className="button button-outline" href="/news">أحدث الأخبار</a>}</div>
        : <div className="nw-grid">{data.items.map((item) => <NewsCard key={item.id} item={toNewsCard(item)} />)}</div>}
      <Pager page={data.page} pagesCount={data.pagesCount} href={(page) => listHref("/news", { page })} />
    </>}
  </main>;
}
