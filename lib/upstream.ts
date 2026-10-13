export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string = code,
    /** The upstream JSON body when there was one (e.g. `largest_available`). */
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export function apiBaseUrl(): string {
  return (process.env.ANSAR_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

/** Public web-api origin for URLs shown to browsers. The API itself may be called on an internal address. */
export function publicApiBaseUrl(): string {
  return (process.env.ANSAR_PUBLIC_API_URL || apiBaseUrl()).replace(/\/+$/, "");
}

/** Absolute http(s) URLs pass; "/path" is resolved against the public web-api origin; everything else (//host, javascript:, data:) is dropped. */
export function absoluteAssetUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const value = url.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  if (/^\/(?!\/)\S*$/.test(value)) return `${publicApiBaseUrl()}${value}`;
  return null;
}

export type UpstreamInit = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Visitor IP. Forwarded only when STOREFRONT_PROXY_SECRET (≥32 chars) is configured. */
  clientIp?: string | null;
};

const MIN_PROXY_SECRET_LENGTH = 32;

export function upstreamHeaders(init: UpstreamInit): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": "ar" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const secret = process.env.STOREFRONT_PROXY_SECRET ?? "";
  if (init.clientIp && secret.length >= MIN_PROXY_SECRET_LENGTH) {
    headers["X-Client-IP"] = init.clientIp;
    headers["X-Storefront-Key"] = secret;
  }
  return headers;
}

/** Raw response (PDF, .pkpass, JSON). Throws UpstreamError(503) only when web-api is unreachable. */
export async function upstreamRaw(path: string, init: UpstreamInit = {}, timeoutMs = 15_000): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers: upstreamHeaders(init),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Next.js aborts static prerendering by throwing from fetch (digest DYNAMIC_SERVER_USAGE).
    // Swallowing it would break `next build`; only real network failures become 503.
    if ((error as { digest?: string } | null)?.digest === "DYNAMIC_SERVER_USAGE") throw error;
    throw new UpstreamError(503, "UPSTREAM_UNAVAILABLE");
  }
}

type JsonBody = Record<string, unknown>;

/** `{ error: { code } }` (envelope), `{ code }` or `{ error: "CODE" }` (flat v2 booking routes). */
function errorCode(json: JsonBody | null, status: number): string {
  const error = json?.error;
  if (error && typeof error === "object") {
    const code = (error as JsonBody).code;
    if (typeof code === "string") return code;
  }
  if (typeof json?.code === "string") return json.code;
  if (typeof error === "string") return error;
  return `HTTP_${status}`;
}

function errorMessage(json: JsonBody | null, code: string): string {
  const error = json?.error;
  if (error && typeof error === "object") {
    const message = (error as JsonBody).message;
    if (typeof message === "string") return message;
  }
  if (typeof json?.message === "string") return json.message;
  return code;
}

/** The parsed JSON body. Throws UpstreamError for network failures, non-2xx, unparseable bodies and bodies carrying an `error`. */
export async function upstreamBody<T>(path: string, init: UpstreamInit = {}): Promise<T> {
  const response = await upstreamRaw(path, init, 10_000);
  if (response.status === 204) return null as T;
  const json = (await response.json().catch(() => null)) as JsonBody | null;
  if (!response.ok || !json || (json.error !== null && json.error !== undefined)) {
    const code = errorCode(json, response.status);
    throw new UpstreamError(response.ok ? 502 : response.status, code, errorMessage(json, code), json ?? {});
  }
  return json as T;
}

/** web-api `{ data, meta, error }` envelope. */
export async function upstream<T>(path: string, init: UpstreamInit = {}): Promise<{ data: T; meta: unknown }> {
  const json = await upstreamBody<JsonBody | null>(path, init);
  if (json === null) return { data: null as T, meta: null };
  return { data: json.data as T, meta: json.meta ?? null };
}
