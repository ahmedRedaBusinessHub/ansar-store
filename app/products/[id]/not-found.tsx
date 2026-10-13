import type { Metadata } from "next";

export const metadata: Metadata = { title: "المنتج غير متاح | متجر الأنصار", robots: { index: false, follow: false } };

export default function ProductNotFound() {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>المنتج غير متاح</h1>
    <p>ربما انتهى عرض هذا المنتج أو تغيّر رابطه.</p>
    <a className="button button-primary" href="/">تصفّح المتجر</a>
  </main>;
}
