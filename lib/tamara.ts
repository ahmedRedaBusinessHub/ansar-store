/** Only Tamara-hosted https checkout pages may receive the shopper (defence against a tampered upstream URL). */
export function isTamaraCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === "https:" && url.username === "" && url.password === ""
    && (url.hostname === "tamara.co" || url.hostname.endsWith(".tamara.co"));
}

const ENTITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What a storefront Tamara checkout pays for: a store order, a season pass, or an event booking. */
export type InstalmentEntity = { type: "ORDER" | "SEASON_PASS" | "EVENT"; id: string };

/** Exactly one of `orderId` / `passId` / `subscriptionId`, a UUID. Anything else is null. */
export function instalmentEntity(input: {
  orderId?: unknown;
  passId?: unknown;
  subscriptionId?: unknown;
}): InstalmentEntity | null {
  const candidates: Array<{ type: InstalmentEntity["type"]; id: unknown }> = [];
  if (input.orderId !== undefined && input.orderId !== null) candidates.push({ type: "ORDER", id: input.orderId });
  if (input.passId !== undefined && input.passId !== null) candidates.push({ type: "SEASON_PASS", id: input.passId });
  if (input.subscriptionId !== undefined && input.subscriptionId !== null) candidates.push({ type: "EVENT", id: input.subscriptionId });
  if (candidates.length !== 1) return null;
  const { type, id } = candidates[0];
  if (typeof id !== "string" || !ENTITY_ID.test(id)) return null;
  return { type, id };
}

