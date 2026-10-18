import type { Metadata } from "next";
import { ContentNotFound } from "@/components/content-parts";

export const metadata: Metadata = { title: "الخبر غير متاح | متجر الأنصار", robots: { index: false, follow: false } };

export default function NewsNotFound() {
  return <ContentNotFound title="الخبر غير متاح" text="ربما حُذف الخبر أو تغيّر رابطه." href="/news" linkLabel="كل الأخبار" />;
}
