import type { Metadata } from "next";
import { MediaDetailRoute, mediaDetailMetadata } from "@/components/media-routes";

export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return mediaDetailMetadata("video", (await params).id);
}

export default async function Page({ params }: Props) {
  return <MediaDetailRoute kind="video" id={(await params).id} />;
}
