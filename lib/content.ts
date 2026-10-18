/** Helpers shared by the content pages (news and gallery): paging, list links and dates. */

export type ListPage<T> = { items: T[]; page: number; pagesCount: number; totalCount: number };

const MAX_PAGE = 1000;

/** "?page=3" → 3. Missing, non-numeric, < 1 or > 1000 → 1, so a bad link never reaches web-api's 400. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,4}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** "/gallery" + { category: "TRAINING", page: 2 } → "/gallery?category=TRAINING&page=2". Page 1 and empty values are omitted. */
export function listHref(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    query.set(key, String(value));
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/** web-api `meta` → page counters. A malformed meta means one page holding what was returned. */
export function readPageMeta(meta: unknown, page: number, itemCount: number): Omit<ListPage<never>, "items"> {
  const record = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  return { page, pagesCount: count(record.pagesCount) ?? 1, totalCount: count(record.totalCount) ?? itemCount };
}

const DATE_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh",
});

/** "15 أكتوبر 2026" in Riyadh time, identical on server and client; "" when there is no date. */
export function formatPublishedDate(iso: string | null): string {
  return iso ? DATE_FORMAT.format(new Date(iso)) : "";
}
