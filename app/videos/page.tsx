import { permanentRedirect } from "next/navigation";
import type { SearchParams } from "@/components/media-routes";
import { listHref, parsePage } from "@/lib/content";
import { GALLERY_PATH, parseCategory } from "@/lib/media";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  permanentRedirect(listHref(GALLERY_PATH, { type: "video", category: parseCategory(params.category), page: parsePage(params.page) }));
}
