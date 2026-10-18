/** Season passes on the storefront (web-season-pass 2026-10-14). Pure helpers: no fetch, no DOM. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Paid tiers sell one pass per purchase; free tiers up to 10 (same rule as the app and web-api). */
export const MAX_FREE_PASSES = 10;

export type SeasonTierMode = "SEAT" | "OPEN";
export type TierBenefit = { label: string; value: string };
export type SeasonInfo = { id: string; year: string };
export type SeasonTier = {
  id: string;
  name: string;
  price: number;
  mode: SeasonTierMode;
  isFull: boolean;
  /** Places left: SEAT = available seats; capped OPEN = capacity − sold; null = uncapped OPEN tier. */
  remaining: number | null;
  description: string | null;
  benefits: TierBenefit[];
  homeMatchesCount: number | null;
};
export type SeasonPassOffer = { season: SeasonInfo; tiers: SeasonTier[] };

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

export function toSeasonInfo(row: unknown): SeasonInfo | null {
  if (!isRow(row)) return null;
  const year = str(row.year) ?? (typeof row.year === "number" ? String(row.year) : null);
  return isUuid(row.id) && year ? { id: row.id, year } : null;
}

/** web-api GET /api/v2/seasons/{id}/tiers row → SeasonTier. null for anything malformed. */
export function toSeasonTier(row: unknown): SeasonTier | null {
  if (!isRow(row)) return null;
  const price = num(row.price);
  const mode = row.mode === "SEAT" || row.mode === "OPEN" ? row.mode : null;
  if (!isUuid(row.id) || price === null || price < 0 || !mode) return null;
  const capacity = num(row.capacity) ?? 0;
  const sold = num(row.sold_count) ?? 0;
  const summary = isRow(row.seat_summary) ? row.seat_summary : null;
  const remaining = mode === "SEAT"
    ? Math.max(0, num(summary?.available) ?? 0)
    : capacity > 0 ? Math.max(0, capacity - sold) : null;
  const benefits = (Array.isArray(row.benefits) ? row.benefits : [])
    .filter(isRow)
    .map((b) => ({ label: str(b.label_ar) ?? str(b.label_en) ?? "", value: str(b.value_ar) ?? str(b.value_en) ?? "" }))
    .filter((b) => b.label !== "" || b.value !== "");
  const home = num(row.home_matches_count);
  return {
    id: row.id,
    name: str(row.name_ar) ?? str(row.name_en) ?? "",
    price,
    mode,
    isFull: row.is_full === true || remaining === 0,
    remaining,
    description: str(row.description_ar) ?? str(row.description_en),
    benefits,
    homeMatchesCount: home !== null && home > 0 ? Math.trunc(home) : null,
  };
}

/** How many passes one purchase may hold: 1 for paid tiers, up to 10 for free ones, never above the places left (min 1). */
export function maxPassQuantity(tier: Pick<SeasonTier, "price" | "remaining">): number {
  const cap = tier.price === 0 ? MAX_FREE_PASSES : 1;
  return tier.remaining === null ? cap : Math.max(1, Math.min(cap, tier.remaining));
}

export type PassStatus = "ACTIVE" | "PENDING_PAYMENT";
export type PassSeat = { sectionName: string; row: string; number: number; gate: string | null };
export type MySeasonPass = {
  id: string;
  status: PassStatus;
  tierName: string;
  seasonYear: string;
  seat: PassSeat | null;
  expiresAt: string | null;
  qrPayload: string | null;
  createdAt: string;
};
/** What the browser receives: the QR as server-rendered SVG, never the raw payload. */
export type MySeasonPassView = Omit<MySeasonPass, "qrPayload"> & { qrSvg: string | null };

/** web-api GET /api/v2/season-passes?my=1 row → MySeasonPass. null for cancelled or malformed rows. */
export function toMySeasonPass(row: unknown): MySeasonPass | null {
  if (!isRow(row)) return null;
  const status = row.status === "ACTIVE" || row.status === "PENDING_PAYMENT" ? row.status : null;
  if (!isUuid(row.id) || !status) return null;
  const tier = isRow(row.tier) ? row.tier : {};
  const season = isRow(row.season) ? row.season : {};
  const seatRow = isRow(row.seat) ? row.seat : null;
  const seatNumber = num(seatRow?.seat_number);
  const seat = seatRow && seatNumber !== null
    ? {
        sectionName: str(seatRow.section_name_ar) ?? str(seatRow.section_name_en) ?? "",
        row: str(seatRow.row_label) ?? "",
        number: seatNumber,
        gate: str(seatRow.gate),
      }
    : null;
  return {
    id: row.id,
    status,
    tierName: str(tier.name_ar) ?? str(tier.name_en) ?? "",
    seasonYear: str(season.year) ?? "",
    seat,
    expiresAt: str(row.expires_at),
    qrPayload: status === "ACTIVE" ? str(row.qr_payload) : null,
    createdAt: str(row.created_at) ?? "",
  };
}

/** ACTIVE passes first, then newest first. */
export function sortPasses<T extends Pick<MySeasonPass, "status" | "createdAt">>(passes: T[]): T[] {
  return [...passes].sort((a, b) => {
    if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function formatPassSeat(seat: PassSeat): string {
  return [seat.sectionName, `الصف ${seat.row}`, `المقعد ${seat.number}`, seat.gate ? `البوابة ${seat.gate}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export type PassCreated = { passId: string; status: PassStatus; expiresAt: string | null };

/** web-api POST /api/v2/season-passes `data`. One payment covers one pass: the first pass is the one to pay for. */
export function toPassCreated(data: unknown): PassCreated | null {
  if (!isRow(data)) return null;
  const status = data.status === "ACTIVE" || data.status === "PENDING_PAYMENT" ? data.status : null;
  const ids = Array.isArray(data.pass_ids) ? data.pass_ids.filter(isUuid) : [];
  if (!status || ids.length === 0) return null;
  const first = Array.isArray(data.passes) ? data.passes.find((p) => isRow(p) && p.id === ids[0]) : undefined;
  return { passId: ids[0], status, expiresAt: isRow(first) ? str(first.expires_at) : null };
}

export type PassErrorView = { message: string; reopenSeats: boolean };
const passView = (message: string, reopenSeats = false): PassErrorView => ({ message, reopenSeats });

export function passErrorView(code: string | null | undefined): PassErrorView {
  switch (code) {
    case "SEASON_SEAT_CONFLICT":
      return passView("سبقك أحد إلى هذا المقعد، اختر مقعدًا آخر.");
    case "SEAT_SELECTION_REQUIRED":
      return passView("اختر مقعدك من خريطة الملعب.", true);
    case "SEATS_NOT_APPLICABLE":
      return passView("هذه الفئة لا تحتاج اختيار مقعد. حدّث الصفحة.");
    case "INSUFFICIENT_SLOTS":
    case "CAPACITY_EXCEEDED":
      return passView("نفدت الأماكن في هذه الفئة.");
    case "PAID_QTY_LIMIT":
      return passView("تذكرة واحدة لكل عملية شراء في الفئات المدفوعة.");
    case "TIER_INACTIVE":
    case "INVALID_STATE":
    case "NOT_FOUND":
    case "not_found":
      return passView("هذه الفئة غير متاحة الآن.");
    case "RATE_LIMIT_EXCEEDED":
    case "rate_limited":
      return passView("محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.");
    case "unauthenticated":
      return passView("سجّل الدخول للمتابعة.");
    case "VALIDATION_ERROR":
    case "invalid_input":
      return passView("تحقق من اختيارك ثم حاول مجددًا.");
    default:
      return passView("تعذّر إتمام الحجز الآن. حاول بعد قليل.");
  }
}

export type TicketCheckoutTarget =
  | { kind: "booking"; bookingId: string; matchId: string | null }
  | { kind: "pass"; passId: string }
  | { kind: "event"; subscriptionId: string; eventId: string | null }
  | { kind: "event-add"; subscriptionId: string; paymentId: string; eventId: string | null };

/**
 * `?booking=` (match tickets, optional `&match=`), `?pass=` (season pass) or `?event=` (event booking,
 * optional `&e={eventId}`; with `&add={paymentId}` it pays an add-tickets payment). Exactly one, UUIDs.
 */
export function parseTicketCheckoutParams(params: URLSearchParams): TicketCheckoutTarget | null {
  const booking = params.get("booking");
  const pass = params.get("pass");
  const event = params.get("event");
  if ([booking, pass, event].filter((value) => value !== null).length !== 1) return null;
  if (booking !== null) {
    if (!isUuid(booking)) return null;
    const match = params.get("match");
    return { kind: "booking", bookingId: booking, matchId: isUuid(match) ? match : null };
  }
  if (pass !== null) return isUuid(pass) ? { kind: "pass", passId: pass } : null;
  if (!isUuid(event)) return null;
  const eventIdParam = params.get("e");
  const eventId = isUuid(eventIdParam) ? eventIdParam : null;
  const add = params.get("add");
  if (add === null) return { kind: "event", subscriptionId: event, eventId };
  return isUuid(add) ? { kind: "event-add", subscriptionId: event, paymentId: add, eventId } : null;
}

/** Whole seconds until `expires`, or null when there is no valid deadline (OPEN passes and GENERAL bookings have none). */
export function holdSecondsLeft(expires: string | null, now: number = Date.now()): number | null {
  if (!expires) return null;
  const deadline = Date.parse(expires);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function passPayHref(passId: string, expiresAt: string | null): string {
  const params = new URLSearchParams({ pass: passId });
  if (expiresAt) params.set("expires", expiresAt);
  return `/checkout/tickets/pay?${params.toString()}`;
}
