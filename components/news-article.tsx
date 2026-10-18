import { ArrowRight, Clock } from "lucide-react";
import { formatPublishedDate } from "@/lib/content";
import { newsUrl, plainText, readingMinutes, toNewsCard, type NewsItem } from "@/lib/news";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { NewsCard } from "./news-card";
import { ShareButtons } from "./share-buttons";
import "./news.css";

export function NewsArticle({ item, related }: { item: NewsItem; related: NewsItem[] }) {
  const safeHtml = sanitizeHtml(item.html);
  // Everything sanitised away (e.g. a body that was only an embed): show the plain text instead.
  const fallback = plainText(safeHtml) ? null : plainText(item.html).split("\n").map((line) => line.trim()).filter(Boolean);
  return <main id="main-content" className="ct-page section-shell">
    <article className="nw-article">
      <a className="text-button" href="/news"><ArrowRight size={16} /> كل الأخبار</a>
      <header>
        {item.isImportant && <span className="nw-badge">خبر مهم</span>}
        <h1>{item.title}</h1>
        <div className="nw-article-meta">
          {item.publishedAt && <time dateTime={item.publishedAt}>{formatPublishedDate(item.publishedAt)}</time>}
          <span><Clock size={14} /> مدة القراءة: {readingMinutes(item.html)} د</span>
        </div>
      </header>
      {item.image && <img className="nw-article-image" src={item.image} alt="" />}
      {fallback
        ? <div className="nw-body">{fallback.map((line, index) => <p key={index}>{line}</p>)}</div>
        : <div className="nw-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />}
      <ShareButtons url={newsUrl(item.id)} title={item.title} />
    </article>
    {related.length > 0 && <section className="nw-related" aria-labelledby="nw-related-title">
      <h2 id="nw-related-title">أخبار أخرى<span className="heading-dot">.</span></h2>
      <div className="nw-grid">{related.map((entry) => <NewsCard key={entry.id} item={toNewsCard(entry)} />)}</div>
    </section>}
  </main>;
}
