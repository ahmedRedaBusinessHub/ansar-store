import type { MyReview, ReviewPage, ReviewSort, ReviewSummary } from "./types";

/** Browser helpers for the storefront review routes. They never throw: failures come back as { ok: false, error }. */
export type ClientResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const base = (productId: string) => `/api/products/${encodeURIComponent(productId)}/reviews`;

async function call<T>(url: string, init: RequestInit = {}): Promise<ClientResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    if (response.status === 204) return { ok: true, data: null as T };
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && body !== null) return { ok: true, data: body as T };
    const code = body !== null && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
    return { ok: false, status: response.status, error: typeof code === "string" ? code : "upstream_unavailable" };
  } catch {
    return { ok: false, status: 0, error: init.signal?.aborted ? "aborted" : "upstream_unavailable" };
  }
}

export function fetchReviewSummary(productId: string, signal?: AbortSignal): Promise<ClientResult<ReviewSummary>> {
  return call<ReviewSummary>(`${base(productId)}/summary`, { signal });
}

export function fetchReviewPage(productId: string, sort: ReviewSort, page: number, signal?: AbortSignal): Promise<ClientResult<ReviewPage>> {
  const query = new URLSearchParams({ sort, page: String(page) });
  return call<ReviewPage>(`${base(productId)}?${query}`, { signal });
}

export function saveMyReview(productId: string, input: { rating: number; comment: string | null }): Promise<ClientResult<MyReview>> {
  return call<MyReview>(`${base(productId)}/mine`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function deleteMyReview(productId: string): Promise<ClientResult<null>> {
  return call<null>(`${base(productId)}/mine`, { method: "DELETE" });
}
