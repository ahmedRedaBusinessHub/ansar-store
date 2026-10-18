import { readPageMeta, type ListPage } from "./content";
import { isMediaId, toMediaItem, type MediaCategory, type MediaItem, type MediaKind } from "./media";
import { upstream, UpstreamError } from "./upstream";

export const MEDIA_PAGE_SIZE = 24;

type Cache = { revalidate?: number };

const MEDIA_TYPE: Record<MediaKind, string> = { photo: "PHOTO", video: "VIDEO" };

/** One page of gallery items, newest first ("all" mixes photos and videos). Throws UpstreamError when web-api is down. */
export async function fetchMediaPage(
  kind: MediaKind | "all",
  options: Cache & { category?: MediaCategory; page?: number; perPage?: number } = {},
): Promise<ListPage<MediaItem>> {
  const page = options.page ?? 1;
  const query = new URLSearchParams({ page: String(page), perPage: String(options.perPage ?? MEDIA_PAGE_SIZE) });
  if (kind !== "all") query.set("media_type", MEDIA_TYPE[kind]);
  if (options.category) query.set("category", options.category);
  const { data, meta } = await upstream<unknown[]>(`/api/v2/gallery?${query}`, { revalidate: options.revalidate });
  const items = (Array.isArray(data) ? data : [])
    .map(toMediaItem)
    .filter((item): item is MediaItem => item !== null && (kind === "all" || item.kind === kind));
  return { items, ...readPageMeta(meta, page, items.length) };
}

/** null for a malformed id, an unknown item, or an item of the other kind (/gallery/{videoId}). */
export async function fetchMediaItem(kind: MediaKind, id: string, cache: Cache = {}): Promise<MediaItem | null> {
  if (!isMediaId(id)) return null;
  try {
    const { data } = await upstream<unknown>(`/api/v2/gallery/${id}`, cache);
    const item = toMediaItem(data);
    return item && item.kind === kind ? item : null;
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
