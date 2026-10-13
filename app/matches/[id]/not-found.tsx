import type { Metadata } from "next";

export const metadata: Metadata = { title: "المباراة غير متاحة | متجر الأنصار", robots: { index: false, follow: false } };

export default function MatchNotFound() {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>المباراة غير متاحة</h1>
    <p>ربما تغيّر رابط المباراة أو لم تُعلن بعد.</p>
    <a className="button button-primary" href="/matches">تذاكر المباريات</a>
  </main>;
}
