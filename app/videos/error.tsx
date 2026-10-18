"use client";

import { ContentError } from "@/components/content-error";

export default function VideosError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ContentError title="تعذّر تحميل الفيديوهات" reset={reset} />;
}
