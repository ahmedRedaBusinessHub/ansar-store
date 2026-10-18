"use client";

import { ContentError } from "@/components/content-error";

export default function NewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ContentError title="تعذّر تحميل الأخبار" reset={reset} />;
}
