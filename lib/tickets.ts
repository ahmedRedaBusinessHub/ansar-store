import { z } from "zod";
import { absoluteAssetUrl } from "./upstream";

export type TicketStatus = "UNUSED" | "USED" | "CANCELLED";
export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
export type TicketItem = { id: string; number: number; status: TicketStatus; qrPayload: string };
export type TicketBooking = {
  id: string; status: BookingStatus; quantity: number; matchId: string; date: string; isHome: boolean;
  opponentNameAr: string; opponentLogo: string | null; stadiumAr: string; sectionNameAr: string; unitPrice: number | null;
  tickets: TicketItem[];
};
/** What the browser receives: the QR as SVG markup instead of its raw payload. */
export type TicketView = { id: string; number: number; status: TicketStatus; qrSvg: string };
export type TicketBookingView = Omit<TicketBooking, "tickets"> & { tickets: TicketView[] };

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "REFUNDED"]),
  quantity: z.number().int().positive(),
  matchId: z.string().min(1),
  match: z.object({
    id: z.string(),
    stadium: z.object({ ar: z.string(), en: z.string() }),
    date: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
    isHome: z.boolean(),
    opponent: z.object({ name: z.object({ ar: z.string(), en: z.string() }), logo: z.string().nullable() }),
  }),
  section: z.object({
    id: z.string(),
    name: z.object({ ar: z.string(), en: z.string() }),
    price: z.union([z.number(), z.string()]).nullable(),
  }).nullable(),
  tickets: z.array(z.object({
    id: z.string().min(1),
    number: z.number().int(),
    status: z.enum(["UNUSED", "USED", "CANCELLED"]),
    qrPayload: z.string().min(1),
  })).optional(),
});

/** Row of GET /api/v2/match-bookings?my=1 (v2 camelCase shape). */
export function toTicketBooking(row: unknown): TicketBooking | null {
  const parsed = schema.safeParse(row);
  if (!parsed.success) return null;
  const b = parsed.data;
  const rawPrice = b.section?.price;
  const price = rawPrice === null || rawPrice === undefined ? null : Number(rawPrice);
  return {
    id: b.id,
    status: b.status,
    quantity: b.quantity,
    matchId: b.matchId,
    date: b.match.date,
    isHome: b.match.isHome,
    opponentNameAr: b.match.opponent.name.ar,
    opponentLogo: absoluteAssetUrl(b.match.opponent.logo),
    stadiumAr: b.match.stadium.ar,
    sectionNameAr: b.section?.name.ar ?? "",
    unitPrice: price !== null && Number.isFinite(price) ? price : null,
    tickets: (b.tickets ?? [])
      .filter((ticket) => ticket.status !== "CANCELLED")
      .map((ticket) => ({ id: ticket.id, number: ticket.number, status: ticket.status, qrPayload: ticket.qrPayload })),
  };
}

/** Confirmed bookings, plus unpaid ones for matches still ahead. Upcoming soonest first, then past latest first. */
export function visibleBookings(bookings: TicketBooking[], now: Date = new Date()): TicketBooking[] {
  const time = now.getTime();
  const shown = bookings.filter((b) =>
    b.status === "CONFIRMED" || (b.status === "PENDING_PAYMENT" && Date.parse(b.date) > time));
  const upcoming = shown.filter((b) => Date.parse(b.date) > time).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const past = shown.filter((b) => Date.parse(b.date) <= time).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return [...upcoming, ...past];
}
