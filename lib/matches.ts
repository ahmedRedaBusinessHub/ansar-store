import type { MetadataRoute } from "next";
import { z } from "zod";
import { formatSar, SITE_URL } from "./product-seo";
import { absoluteAssetUrl } from "./upstream";

export const HOME_TEAM_AR = "الأنصار";
export const HOME_TEAM_EN = "AL ANSAR";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMatchId(value: string): boolean {
  return UUID.test(value);
}

export function matchPath(id: string): string {
  return `/matches/${id}`;
}

export function matchUrl(id: string): string {
  return `${SITE_URL}${matchPath(id)}`;
}

export type SalesState = "OPEN" | "NOT_OPEN" | "CLOSED";
export type MatchTeam = { nameAr: string; nameEn: string; logo: string | null };
export type TicketedMatch = {
  id: string; date: string; opponent: MatchTeam; stadiumAr: string; stadiumEn: string; competitionAr: string | null;
  salesState: "OPEN" | "NOT_OPEN"; salesOpenAt: string | null; minPrice: number | null;
};
export type MatchDetail = {
  id: string; date: string; opponent: MatchTeam; stadiumAr: string; stadiumEn: string; competitionAr: string | null;
  isHome: boolean; isTicketable: boolean; isBookable: boolean; salesState: SalesState; salesOpenAt: string | null; minPrice: number | null;
};
export type MatchSection = { id: string; name: string; kind: "GENERAL" | "SEATED"; price: number | null; isFull: boolean; remaining: number | null };

const id = z.string().refine(isMatchId);
const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const price = z.union([z.string(), z.number()]).nullable().transform((value) => {
  if (value === null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
});

const ticketedSchema = z.object({
  id,
  match_date: isoDate,
  opponent: z.object({ name_ar: z.string(), name_en: z.string(), logo: z.string().nullable() }),
  stadium_ar: z.string(),
  stadium_en: z.string(),
  competition_ar: z.string().nullable(),
  sales_state: z.enum(["OPEN", "NOT_OPEN"]),
  sales_open_at: isoDate.nullable(),
  min_price: price,
});

const detailSchema = z.object({
  id,
  match_date: isoDate,
  opponent_name_ar: z.string(),
  opponent_name_en: z.string(),
  opponent_image_url: z.string().nullable(),
  stadium_ar: z.string(),
  stadium_en: z.string(),
  competition_ar: z.string().nullable(),
  is_alansar_home: z.boolean(),
});

const salesSchema = z.object({
  is_ticketable: z.boolean(),
  is_bookable: z.boolean(),
  sales_state: z.enum(["OPEN", "NOT_OPEN", "CLOSED"]),
  sales_open_at: isoDate.nullable(),
  min_price: price,
});

const sectionSchema = z.object({
  id: z.string().min(1),
  name_ar: z.string(),
  kind: z.enum(["GENERAL", "SEATED"]),
  price: z.number().nullable(),
  capacity: z.number(),
  booked_count: z.number(),
  is_full: z.boolean(),
});

/** Row of GET /api/v2/matches/ticketed. */
export function toTicketedMatch(row: unknown): TicketedMatch | null {
  const parsed = ticketedSchema.safeParse(row);
  if (!parsed.success) return null;
  const m = parsed.data;
  return {
    id: m.id, date: m.match_date,
    opponent: { nameAr: m.opponent.name_ar, nameEn: m.opponent.name_en, logo: absoluteAssetUrl(m.opponent.logo) },
    stadiumAr: m.stadium_ar, stadiumEn: m.stadium_en, competitionAr: m.competition_ar,
    salesState: m.sales_state, salesOpenAt: m.sales_open_at, minPrice: m.min_price,
  };
}

/** GET /api/v2/matches/{id} (data) joined with GET /api/v2/matches/{id}/sales-info (data). */
export function toMatchDetail(matchRow: unknown, salesRow: unknown): MatchDetail | null {
  const match = detailSchema.safeParse(matchRow);
  const sales = salesSchema.safeParse(salesRow);
  if (!match.success || !sales.success) return null;
  const m = match.data;
  const s = sales.data;
  return {
    id: m.id, date: m.match_date,
    opponent: { nameAr: m.opponent_name_ar, nameEn: m.opponent_name_en, logo: absoluteAssetUrl(m.opponent_image_url) },
    stadiumAr: m.stadium_ar, stadiumEn: m.stadium_en, competitionAr: m.competition_ar,
    isHome: m.is_alansar_home, isTicketable: s.is_ticketable, isBookable: s.is_bookable,
    salesState: s.sales_state, salesOpenAt: s.sales_open_at, minPrice: s.min_price,
  };
}

/** Row of GET /api/v2/matches/{id}/sections. */
export function toMatchSection(row: unknown): MatchSection | null {
  const parsed = sectionSchema.safeParse(row);
  if (!parsed.success) return null;
  const s = parsed.data;
  return {
    id: s.id, name: s.name_ar, kind: s.kind,
    price: s.price === null ? null : Math.round(s.price * 100) / 100,
    isFull: s.is_full,
    remaining: s.capacity > 0 ? Math.max(0, s.capacity - s.booked_count) : null,
  };
}

// Asia/Riyadh is UTC+3 all year (no DST). Intl is avoided on purpose: ar-SA defaults to the Hijri calendar.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const AR_WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const EN_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function riyadh(isoValue: string): Date {
  return new Date(Date.parse(isoValue) + RIYADH_OFFSET_MS);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "الأحد 18 أكتوبر 2026" */
export function formatMatchDate(isoValue: string): string {
  const d = riyadh(isoValue);
  return `${AR_WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${AR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "8:00 م" */
export function formatMatchTime(isoValue: string): string {
  const d = riyadh(isoValue);
  const hours = d.getUTCHours();
  return `${hours % 12 || 12}:${pad(d.getUTCMinutes())} ${hours < 12 ? "ص" : "م"}`;
}

/** "الأحد 18 أكتوبر 8:00 م" */
export function formatMatchShortDateTime(isoValue: string): string {
  const d = riyadh(isoValue);
  return `${AR_WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${AR_MONTHS[d.getUTCMonth()]} ${formatMatchTime(isoValue)}`;
}

/** "SUN 18 OCT 2026 · 20:00" — Latin only, for the Open Graph image. */
export function englishDateLabel(isoValue: string): string {
  const d = riyadh(isoValue);
  return `${EN_WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function matchTitle(m: Pick<MatchDetail, "opponent" | "isHome">): string {
  return m.isHome ? `${HOME_TEAM_AR} × ${m.opponent.nameAr}` : `${m.opponent.nameAr} × ${HOME_TEAM_AR}`;
}

/** Share-sheet text; the URL is passed separately. */
export function matchShareText(m: Pick<MatchDetail, "opponent" | "isHome" | "date">): string {
  return `${matchTitle(m)} — ${formatMatchShortDateTime(m.date)}`;
}

export function matchDescription(m: Pick<MatchDetail, "date" | "stadiumAr" | "competitionAr">): string {
  const parts = [formatMatchDate(m.date), formatMatchTime(m.date), m.stadiumAr];
  if (m.competitionAr) parts.push(m.competitionAr);
  return parts.join(" · ");
}

export function formatSectionPrice(amount: number): string {
  return amount === 0 ? "مجاني" : `${formatSar(amount)} ر.س`;
}

export function salesOpeningLabel(salesOpenAt: string): string {
  return `يبدأ البيع ${formatMatchShortDateTime(salesOpenAt)}`;
}

export function isPastMatch(m: Pick<MatchDetail, "date">, now: Date = new Date()): boolean {
  return Date.parse(m.date) <= now.getTime();
}

export function matchJsonLd(m: MatchDetail): Record<string, unknown> {
  const home = { "@type": "SportsTeam", name: HOME_TEAM_AR };
  const opponent = { "@type": "SportsTeam", name: m.opponent.nameAr };
  const url = matchUrl(m.id);
  const sellable = m.isTicketable && m.minPrice !== null && (m.isBookable || m.salesState === "NOT_OPEN");
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: matchTitle(m),
    startDate: m.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: m.stadiumAr, address: { "@type": "PostalAddress", addressCountry: "SA" } },
    homeTeam: m.isHome ? home : opponent,
    awayTeam: m.isHome ? opponent : home,
    url,
    ...(sellable && m.minPrice !== null
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: m.minPrice.toFixed(2),
            priceCurrency: "SAR",
            availability: m.isBookable ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
            ...(m.salesOpenAt ? { validFrom: m.salesOpenAt } : {}),
          },
        }
      : {}),
  };
}

export function matchSitemapEntries(matches: TicketedMatch[], lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/matches`, lastModified, changeFrequency: "daily", priority: 0.9 },
    ...matches.map((match) => ({ url: matchUrl(match.id), lastModified, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
