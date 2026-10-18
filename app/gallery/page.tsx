import { MediaListRoute, mediaListMetadata, type SearchParams } from "@/components/media-routes";

export const revalidate = 300;
export const metadata = mediaListMetadata();

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <MediaListRoute searchParams={searchParams} />;
}
