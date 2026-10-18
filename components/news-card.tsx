import { formatPublishedDate } from "@/lib/content";
import { newsPath, type NewsCardData } from "@/lib/news";
import "./news.css";

export function NewsCard({ item }: { item: NewsCardData }) {
  return <article className="nw-card">
    <a className="nw-card-link" href={newsPath(item.id)}>
      <div className="nw-card-media">
        {item.image
          ? <img src={item.image} alt="" loading="lazy" />
          : <img className="nw-card-crest" src="/images/crest.svg" alt="" loading="lazy" />}
      </div>
      <div className="nw-card-body">
        {item.publishedAt && <time dateTime={item.publishedAt}>{formatPublishedDate(item.publishedAt)}</time>}
        <h3>{item.title}</h3>
        {item.summary && <p>{item.summary}</p>}
      </div>
    </a>
  </article>;
}
