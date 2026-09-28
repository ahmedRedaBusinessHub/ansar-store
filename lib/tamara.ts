/** Only Tamara-hosted https checkout pages may receive the shopper (defence against a tampered upstream URL). */
export function isTamaraCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === "https:" && url.username === "" && url.password === ""
    && (url.hostname === "tamara.co" || url.hostname.endsWith(".tamara.co"));
}
