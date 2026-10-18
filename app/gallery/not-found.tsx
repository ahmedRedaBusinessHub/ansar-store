import type { Metadata } from "next";
import { ContentNotFound } from "@/components/content-parts";

export const metadata: Metadata = { title: "الصورة غير متاحة | متجر الأنصار", robots: { index: false, follow: false } };

export default function GalleryNotFound() {
  return <ContentNotFound title="الصورة غير متاحة" text="ربما حُذفت الصورة أو تغيّر رابطها." href="/gallery" linkLabel="المعرض" />;
}
