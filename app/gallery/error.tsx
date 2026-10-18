"use client";

import { ContentError } from "@/components/content-error";

export default function GalleryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ContentError title="تعذّر تحميل المعرض" reset={reset} />;
}
