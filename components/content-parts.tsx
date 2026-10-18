import { ArrowLeft, ArrowRight } from "lucide-react";

/** Newer/older links between pages of a list. Renders nothing for a single page. */
export function Pager({ page, pagesCount, href }: { page: number; pagesCount: number; href: (page: number) => string }) {
  if (pagesCount <= 1) return null;
  return <nav className="ct-pager" aria-label="الصفحات">
    {page > 1 ? <a href={href(page - 1)} rel="prev"><ArrowRight size={16} /> الأحدث</a> : <span />}
    <span>صفحة {page} من {pagesCount}</span>
    {page < pagesCount ? <a href={href(page + 1)} rel="next">الأقدم <ArrowLeft size={16} /></a> : <span />}
  </nav>;
}

/** List body when web-api could not be reached. The page itself still renders (never a 500). */
export function ContentUnavailable({ retryHref }: { retryHref: string }) {
  return <div className="ct-empty" role="status">
    <h2>تعذّر تحميل المحتوى الآن</h2>
    <p>حاول مرة أخرى بعد لحظات.</p>
    <a className="button button-primary" href={retryHref}>إعادة المحاولة</a>
  </div>;
}

export function ContentNotFound({ title, text, href, linkLabel }: { title: string; text: string; href: string; linkLabel: string }) {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>{title}</h1>
    <p>{text}</p>
    <a className="button button-primary" href={href}>{linkLabel}</a>
  </main>;
}
