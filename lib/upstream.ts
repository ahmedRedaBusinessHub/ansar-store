export class UpstreamError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string = code) {
    super(message);
    this.name = "UpstreamError";
  }
}

export function apiBaseUrl(): string {
  return (process.env.ANSAR_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

/** Absolute http(s) URLs pass; "/path" is resolved against web-api; everything else (//host, javascript:, data:) is dropped. */
export function absoluteAssetUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const value = url.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  if (/^\/(?!\/)\S*$/.test(value)) return `${apiBaseUrl()}${value}`;
  return null;
}

type Envelope<T> = { data?: T; meta?: unknown; error?: { code?: unknown; message?: unknown } | null };

export async function upstream<T>(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<{ data: T; meta: unknown }> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": "ar" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new UpstreamError(503, "UPSTREAM_UNAVAILABLE");
  }
  const json = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !json || (json.error !== null && json.error !== undefined)) {
    const code = typeof json?.error?.code === "string" ? json.error.code : `HTTP_${response.status}`;
    const message = typeof json?.error?.message === "string" ? json.error.message : code;
    throw new UpstreamError(response.ok ? 502 : response.status, code, message);
  }
  return { data: json.data as T, meta: json.meta ?? null };
}
