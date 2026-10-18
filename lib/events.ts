import type { MetadataRoute } from "next";
import { z } from "zod";
import { formatMatchDate, formatMatchTime } from "./matches";
import { formatSar, SITE_URL } from "./product-seo";
import { absoluteAssetUrl } from "./upstream";

export const MAX_TICKETS_PER_EVENT_BOOKING = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventId(value: string): boolean {
  return UUID.test(value);
}
export const eventPath = (id: string) => `/events/${id}`;
export const eventUrl = (id: string) => `${SITE_URL}${eventPath(id)}`;

export type EventAvailability = { total: number; available: number; full: boolean } | null;
export type EventSummary = {
  id: string; titleAr: string; descriptionAr: string; image: string | null; date: string;
  price: number; externalUrl: string | null; availability: EventAvailability;
};
export type EventBookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
export type NotBookableReason = "PAST" | "EXTERNAL" | "BOOKED" | "FULL";
export type EventBookingInfo = {
  event: EventSummary;
  myBooking: { id: string; status: EventBookingStatus; quantity: number; holdExpiresAt: string | null } | null;
  bookable: boolean;
  reason: NotBookableReason | null;
  maxPerBooking: number;
};
export type EventTicket = { id: string; number: number; status: "UNUSED" | "USED" | "CANCELLED"; qrPayload: string };
export type MyEventBooking = {
  id: string; status: "PENDING_PAYMENT" | "CONFIRMED"; quantity: number; holdExpiresAt: string | null;
  event: { id: string; titleAr: string; image: string | null; date: string; price: number };
  tickets: EventTicket[];
};
export type MyEventBookingView = Omit<MyEventBooking, "tickets"> & {
  tickets: Array<Omit<EventTicket, "qrPayload"> & { qrSvg: string }>;
};

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const price = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().finite().min(0));
const availabilitySchema = z.object({
  total_capacity: z.number(), available_slots: z.number(), is_fully_booked: z.boolean(),
}).nullable().optional();
const eventSchema = z.object({
  id: z.string().regex(UUID),
  title_ar: z.string().min(1),
  description_ar: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  date: isoDate,
  price,
  external_booking_url: z.string().nullable().optional(),
  availability: availabilitySchema,
});
const statusSchema = z.enum(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "REFUNDED"]);

export function toEventSummary(row: unknown): EventSummary | null {
  const parsed = eventSchema.safeParse(row);
  if (!parsed.success) return null;
  const e = parsed.data;
  return {
    id: e.id, titleAr: e.title_ar, descriptionAr: e.description_ar ?? "", image: absoluteAssetUrl(e.image_url),
    date: e.date, price: e.price, externalUrl: e.external_booking_url ? e.external_booking_url : null,
    availability: e.availability
      ? { total: e.availability.total_capacity, available: e.availability.available_slots, full: e.availability.is_fully_booked }
      : null,
  };
}

const infoSchema = z.object({
  event: z.unknown(),
  my_booking: z.object({ id: z.string(), status: statusSchema, quantity: z.number().int(), hold_expires_at: z.string().nullable() }).nullable(),
  bookable: z.boolean(),
  not_bookable_reason: z.enum(["PAST", "EXTERNAL", "BOOKED", "FULL"]).nullable(),
  max_per_booking: z.number().int().positive(),
});

export function toEventBookingInfo(row: unknown): EventBookingInfo | null {
  const parsed = infoSchema.safeParse(row);
  if (!parsed.success) return null;
  const event = toEventSummary(parsed.data.event);
  if (!event) return null;
  const mine = parsed.data.my_booking;
  return {
    event,
    myBooking: mine ? { id: mine.id, status: mine.status, quantity: mine.quantity, holdExpiresAt: mine.hold_expires_at } : null,
    bookable: parsed.data.bookable,
    reason: parsed.data.not_bookable_reason,
    maxPerBooking: parsed.data.max_per_booking,
  };
}

const myBookingSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING_PAYMENT", "CONFIRMED"]),
  quantity: z.number().int().positive(),
  hold_expires_at: z.string().nullable(),
  event: z.object({ id: z.string(), title_ar: z.string(), image_url: z.string().nullable().optional(), date: isoDate, price }),
  tickets: z.array(z.object({
    id: z.string(), ticket_number: z.number().int(), status: z.enum(["UNUSED", "USED", "CANCELLED"]), qr_payload: z.string().min(1),
  })),
});

export function toMyEventBooking(row: unknown): MyEventBooking | null {
  const parsed = myBookingSchema.safeParse(row);
  if (!parsed.success) return null;
  const b = parsed.data;
  return {
    id: b.id, status: b.status, quantity: b.quantity, holdExpiresAt: b.hold_expires_at,
    event: { id: b.event.id, titleAr: b.event.title_ar, image: absoluteAssetUrl(b.event.image_url), date: b.event.date, price: b.event.price },
    tickets: b.tickets.map((t) => ({ id: t.id, number: t.ticket_number, status: t.status, qrPayload: t.qr_payload })),
  };
}

export function eventDateLabel(iso: string): string {
  return `${formatMatchDate(iso)} · ${formatMatchTime(iso)}`;
}

export function eventPriceLabel(value: number): string {
  return value === 0 ? "مجاني" : `${formatSar(value)} ر.س`;
}

export function isPastEvent(iso: string, now: number = Date.now()): boolean {
  return Date.parse(iso) < now;
}

export function maxEventQuantity(info: EventBookingInfo): number {
  const available = info.event.availability?.available ?? info.maxPerBooking;
  return Math.max(1, Math.min(info.maxPerBooking, available));
}

export function eventJsonLd(e: EventSummary): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titleAr,
    description: e.descriptionAr || e.titleAr,
    startDate: e.date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    ...(e.image ? { image: [e.image] } : {}),
    url: eventUrl(e.id),
    location: {
      "@type": "Place",
      name: "نادي الأنصار",
      address: { "@type": "PostalAddress", addressLocality: "المدينة المنورة", addressCountry: "SA" },
    },
    organizer: { "@type": "SportsOrganization", name: "نادي الأنصار", url: SITE_URL },
    ...(e.externalUrl ? {} : {
      offers: {
        "@type": "Offer",
        price: e.price.toFixed(2),
        priceCurrency: "SAR",
        url: eventUrl(e.id),
        availability: e.availability?.full ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      },
    }),
  };
}

export function eventSitemapEntries(events: EventSummary[], lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/events`, lastModified, changeFrequency: "daily", priority: 0.8 },
    ...events.map((e) => ({ url: eventUrl(e.id), lastModified, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
