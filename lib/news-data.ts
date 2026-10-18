import { readPageMeta, type ListPage } from "./content";
import { isNewsId, toNewsItem, type NewsItem } from "./news";
import { upstream, UpstreamError } from "./upstream";

export const NEWS_PAGE_SIZE = 12;

type Cache = { revalidate?: number };

/** One page of news, newest first. Throws UpstreamError when web-api is down. */
export async function fetchNewsPage(page: number, options: Cache & { perPage?: number; important?: boolean } = {}): Promise<ListPage<NewsItem>> {
  const query = new URLSearchParams({ page: String(page), perPage: String(options.perPage ?? NEWS_PAGE_SIZE) });
  if (options.important) query.set("important", "true");
  const { data, meta } = await upstream<unknown[]>(`/api/v2/news?${query}`, { revalidate: options.revalidate });
  const items = (Array.isArray(data) ? data : [])
    .map(toNewsItem)
    .filter((item): item is NewsItem => item !== null);
  return { items, ...readPageMeta(meta, page, items.length) };
}

/** null for a malformed or unknown id. Other failures throw so the page shows its error boundary. */
export async function fetchNewsItem(id: string, cache: Cache = {}): Promise<NewsItem | null> {
  if (!isNewsId(id)) return null;
  try {
    const { data } = await upstream<unknown>(`/api/v2/news/${encodeURIComponent(id)}`, cache);
    return toNewsItem(data);
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
