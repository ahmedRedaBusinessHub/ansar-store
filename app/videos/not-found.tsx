import type { Metadata } from "next";
import { ContentNotFound } from "@/components/content-parts";

export const metadata: Metadata = { title: "الفيديو غير متاح | متجر الأنصار", robots: { index: false, follow: false } };

export default function VideosNotFound() {
  return <ContentNotFound title="الفيديو غير متاح" text="ربما حُذف الفيديو أو تغيّر رابطه." href="/gallery?type=video" linkLabel="المعرض" />;
}
