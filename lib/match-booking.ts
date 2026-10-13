// Pure booking helpers shared by the BFF route and the match page. No next/* imports.

export const MAX_TICKETS_PER_MATCH = 10;

export type SectionKind = "GENERAL" | "SEATED";
export type BookingCreated = { bookingId: string; status: "PENDING_PAYMENT" | "CONFIRMED"; expiresAt: string | null };
export type BookingErrorView = { message: string; suggestQuantity: number | null };

/** GENERAL sections book a quantity; SEATED sections hold the best contiguous seats (works whether or not the seat picker is enabled). */
export function bookingUpstream(kind: SectionKind, matchId: string, sectionId: string, quantity: number): { path: string; body: Record<string, unknown> } {
  if (kind === "SEATED") return { path: `/api/v2/matches/${matchId}/best-available`, body: { section_id: sectionId, quantity } };
  return { path: "/api/v2/match-bookings", body: { match_id: matchId, section_id: sectionId, quantity } };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * GENERAL: `{ booking: { id, status } }`. SEATED: `{ data: { booking_id, expires_at } }`, which does not say
 * whether the section was free, so the caller passes `isFree` from the section price (free → confirmed, no hold).
 */
export function toBookingCreated(kind: SectionKind, body: unknown, isFree: boolean): BookingCreated | null {
  const root = record(body);
  if (kind === "SEATED") {
    const data = record(root?.data);
    const bookingId = data?.booking_id;
    if (typeof bookingId !== "string" || bookingId === "") return null;
    if (isFree) return { bookingId, status: "CONFIRMED", expiresAt: null };
    const expires = data?.expires_at;
    const expiresAt = typeof expires === "string" && !Number.isNaN(Date.parse(expires)) ? expires : null;
    return { bookingId, status: "PENDING_PAYMENT", expiresAt };
  }
  const booking = record(root?.booking);
  const bookingId = booking?.id;
  const status = booking?.status;
  if (typeof bookingId !== "string" || bookingId === "") return null;
  if (status !== "PENDING_PAYMENT" && status !== "CONFIRMED") return null;
  return { bookingId, status, expiresAt: null };
}

const view = (message: string): BookingErrorView => ({ message, suggestQuantity: null });

export function bookingErrorView(code: string | null | undefined, largestAvailable: number | null, requested: number): BookingErrorView {
  switch (code) {
    case "SALES_CLOSED":
      return view("البيع مغلق حاليًا أو لم يبدأ بعد.");
    case "MATCH_NOT_SELLABLE":
    case "NOT_FOUND":
    case "not_found":
      return view("المباراة غير متاحة للبيع.");
    case "BOOKING_LIMIT_EXCEEDED":
      return view(`وصلت للحد الأقصى: ${MAX_TICKETS_PER_MATCH} تذاكر لكل مباراة.`);
    case "INSUFFICIENT_SLOTS":
      return view(`الكمية المطلوبة غير متاحة. الحد الأقصى ${MAX_TICKETS_PER_MATCH} تذاكر لكل مباراة، وقد تكون المقاعد المتبقية أقل.`);
    case "NO_CONTIGUOUS_BLOCK":
      if (largestAvailable !== null && largestAvailable > 0 && largestAvailable < requested) {
        return { message: `لا توجد ${requested} مقاعد متجاورة. أكبر عدد متاح الآن ${largestAvailable}.`, suggestQuantity: largestAvailable };
      }
      return view("لا توجد مقاعد متاحة في هذا القسم الآن.");
    case "SEAT_CONFLICT":
      return view("حُجزت المقاعد قبلك، حاول مرة أخرى.");
    case "RATE_LIMIT_EXCEEDED":
    case "rate_limited":
      return view("محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.");
    case "INVALID_STATE":
      return view("هذه المباراة أو هذا القسم غير متاح للحجز الآن.");
    case "VALIDATION_ERROR":
    case "QUANTITY_REQUIRED":
    case "SECTION_NOT_PRICED":
    case "invalid_input":
      return view("اختر قسمًا وعددًا صحيحًا.");
    case "unauthenticated":
      return view("سجّل الدخول للمتابعة.");
    default:
      return view("تعذّر إتمام الحجز الآن. حاول بعد قليل.");
  }
}
