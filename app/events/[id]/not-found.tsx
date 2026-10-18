import type { Metadata } from "next";

export const metadata: Metadata = { title: "الفعالية غير متاحة | متجر الأنصار", robots: { index: false, follow: false } };

export default function EventNotFound() {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>الفعالية غير متاحة</h1>
    <p>ربما تغيّر رابط الفعالية أو لم تُعلن بعد.</p>
    <a className="button button-primary" href="/events">كل الفعاليات</a>
  </main>;
}
