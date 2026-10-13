import { isIP } from "node:net";

/** Proxies in front of this app (WAF, nginx), from TRUSTED_PROXY_IPS (comma-separated). */
export function trustedProxies(): Set<string> {
  return new Set((process.env.TRUSTED_PROXY_IPS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

/**
 * The visitor's IP behind WAF → nginx. Walks X-Forwarded-For from the right,
 * skipping trusted hops, and returns the first other hop. The left-most value is
 * client-controlled and is never trusted on its own. null = unknown.
 */
export function clientIpFrom(headers: Headers, trusted: ReadonlySet<string> = trustedProxies()): string | null {
  const hops = (headers.get("x-forwarded-for") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  for (let index = hops.length - 1; index >= 0; index--) {
    const hop = hops[index];
    if (trusted.has(hop)) continue;
    return isIP(hop) !== 0 ? hop : null;
  }
  const real = headers.get("x-real-ip")?.trim() ?? "";
  if (real && !trusted.has(real) && isIP(real) !== 0) return real;
  return null;
}
