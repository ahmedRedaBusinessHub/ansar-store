import test from "node:test";
import assert from "node:assert/strict";
import {
  englishDateLabel, formatMatchDate, formatMatchShortDateTime, formatMatchTime, formatSectionPrice, HOME_TEAM_AR,
  isMatchId, isPastMatch, matchDescription, matchJsonLd, matchPath, matchShareText, matchSitemapEntries, matchTitle,
  matchUrl, salesOpeningLabel, toMatchDetail, toMatchSection, toTicketedMatch, type MatchDetail,
} from "../lib/matches";
import { jsonLdScript } from "../lib/product-seo";

process.env.ANSAR_API_BASE_URL = "http://api.test";
const ID = "11111111-1111-4111-8111-111111111111";
const SECTION = "22222222-2222-4222-8222-222222222222";

const detail: MatchDetail = {
  id: ID, date: "2026-10-18T17:00:00.000Z",
  opponent: { nameAr: "الهلال", nameEn: "Al Hilal", logo: "http://api.test/uploads/hilal.png" },
  stadiumAr: "ملعب الأمير محمد بن عبدالعزيز", stadiumEn: "Prince Mohammed bin Abdulaziz Stadium", competitionAr: "دوري يلو",
  isHome: true, isTicketable: true, isBookable: true, salesState: "OPEN", salesOpenAt: null, minPrice: 75.5,
};

test("isMatchId accepts UUIDs only; paths use the production origin", () => {
  assert.equal(isMatchId(ID), true);
  assert.equal(isMatchId(ID.toUpperCase()), true);
  for (const bad of ["", "abc", "../etc/passwd", `${ID}x`, `/${ID}`]) assert.equal(isMatchId(bad), false, bad);
  assert.equal(matchPath(ID), `/matches/${ID}`);
  assert.equal(matchUrl(ID), `https://store.alansar.sa/matches/${ID}`);
});

test("dates are Asia/Riyadh (UTC+3) with Gregorian Arabic names", () => {
  assert.equal(formatMatchDate("2026-10-18T17:00:00.000Z"), "الأحد 18 أكتوبر 2026");
  assert.equal(formatMatchTime("2026-10-18T17:00:00.000Z"), "8:00 م");
  assert.equal(formatMatchDate("2026-10-18T21:30:00.000Z"), "الاثنين 19 أكتوبر 2026");
  assert.equal(formatMatchTime("2026-10-18T21:30:00.000Z"), "12:30 ص");
  assert.equal(formatMatchDate("2026-12-31T22:05:00.000Z"), "الجمعة 1 يناير 2027");
  assert.equal(formatMatchTime("2026-12-31T22:05:00.000Z"), "1:05 ص");
  assert.equal(formatMatchShortDateTime("2026-10-18T17:00:00.000Z"), "الأحد 18 أكتوبر 8:00 م");
  assert.equal(englishDateLabel("2026-10-18T17:00:00.000Z"), "SUN 18 OCT 2026 · 20:00");
});

test("titles put the home team first; share text and description", () => {
  assert.equal(HOME_TEAM_AR, "الأنصار");
  assert.equal(matchTitle(detail), "الأنصار × الهلال");
  assert.equal(matchTitle({ ...detail, isHome: false }), "الهلال × الأنصار");
  assert.equal(matchShareText(detail), "الأنصار × الهلال — الأحد 18 أكتوبر 8:00 م");
  assert.equal(matchDescription(detail), "الأحد 18 أكتوبر 2026 · 8:00 م · ملعب الأمير محمد بن عبدالعزيز · دوري يلو");
  assert.equal(matchDescription({ ...detail, competitionAr: null }), "الأحد 18 أكتوبر 2026 · 8:00 م · ملعب الأمير محمد بن عبدالعزيز");
});

test("prices, sales opening and past matches", () => {
  assert.equal(formatSectionPrice(0), "مجاني");
  assert.equal(formatSectionPrice(150), "150 ر.س");
  assert.equal(formatSectionPrice(75.5), "75.50 ر.س");
  assert.equal(salesOpeningLabel("2026-10-14T09:00:00.000Z"), "يبدأ البيع الأربعاء 14 أكتوبر 12:00 م");
  assert.equal(isPastMatch(detail, new Date("2026-10-18T16:59:59.000Z")), false);
  assert.equal(isPastMatch(detail, new Date("2026-10-18T17:00:00.000Z")), true);
});

test("toTicketedMatch maps the web-api row and makes logos absolute", () => {
  const row = {
    id: ID, match_date: "2026-10-18T17:00:00.000Z",
    opponent: { name_ar: "الهلال", name_en: "Al Hilal", logo: "/uploads/hilal.png" },
    stadium_ar: "ملعب", stadium_en: "Stadium", competition_ar: null, competition_en: null, club_division: "FIRST_TEAM",
    sales_state: "NOT_OPEN", sales_open_at: "2026-10-14T09:00:00.000Z", sales_close_at: null, min_price: "75.50",
  };
  assert.deepEqual(toTicketedMatch(row), {
    id: ID, date: "2026-10-18T17:00:00.000Z",
    opponent: { nameAr: "الهلال", nameEn: "Al Hilal", logo: "http://api.test/uploads/hilal.png" },
    stadiumAr: "ملعب", stadiumEn: "Stadium", competitionAr: null,
    salesState: "NOT_OPEN", salesOpenAt: "2026-10-14T09:00:00.000Z", minPrice: 75.5,
  });
  assert.equal(toTicketedMatch({ ...row, id: "nope" }), null);
  assert.equal(toTicketedMatch({ ...row, sales_state: "CLOSED" }), null);
  assert.equal(toTicketedMatch(null), null);
});

test("toMatchDetail joins the match row with sales info", () => {
  const matchRow = {
    id: ID, match_date: "2026-10-18T17:00:00.000Z", opponent_name_ar: "الهلال", opponent_name_en: "Al Hilal",
    opponent_image_url: null, stadium_ar: "ملعب", stadium_en: "Stadium", competition_ar: "دوري يلو", is_alansar_home: true,
  };
  const sales = { is_ticketable: true, is_bookable: false, sales_state: "CLOSED", sales_open_at: null, sales_close_at: null, min_price: null };
  assert.deepEqual(toMatchDetail(matchRow, sales), {
    id: ID, date: "2026-10-18T17:00:00.000Z", opponent: { nameAr: "الهلال", nameEn: "Al Hilal", logo: null },
    stadiumAr: "ملعب", stadiumEn: "Stadium", competitionAr: "دوري يلو",
    isHome: true, isTicketable: true, isBookable: false, salesState: "CLOSED", salesOpenAt: null, minPrice: null,
  });
  assert.equal(toMatchDetail(matchRow, null), null);
  assert.equal(toMatchDetail({ ...matchRow, id: "x" }, sales), null);
});

test("toMatchSection maps kind, price and remaining capacity", () => {
  const row = { id: SECTION, match_id: ID, name_ar: "المدرج الشرقي", name_en: "East", kind: "GENERAL", venue_section_id: null,
    price: 100, capacity: 500, booked_count: 20, is_full: false, created_at: "2026-10-01T00:00:00.000Z" };
  assert.deepEqual(toMatchSection(row), { id: SECTION, name: "المدرج الشرقي", kind: "GENERAL", price: 100, isFull: false, remaining: 480 });
  assert.deepEqual(toMatchSection({ ...row, kind: "SEATED", capacity: 0, price: null }),
    { id: SECTION, name: "المدرج الشرقي", kind: "SEATED", price: null, isFull: false, remaining: null });
  assert.equal(toMatchSection({ ...row, kind: "VIP" }), null);
});

test("SportsEvent JSON-LD: offers only when sellable, and safe inside <script>", () => {
  const ld = matchJsonLd(detail);
  assert.equal(ld["@type"], "SportsEvent");
  assert.equal(ld.startDate, "2026-10-18T17:00:00.000Z");
  assert.deepEqual(ld.homeTeam, { "@type": "SportsTeam", name: "الأنصار" });
  assert.deepEqual(ld.awayTeam, { "@type": "SportsTeam", name: "الهلال" });
  assert.deepEqual(ld.offers, { "@type": "Offer", url: matchUrl(ID), price: "75.50", priceCurrency: "SAR", availability: "https://schema.org/InStock" });
  const soon = matchJsonLd({ ...detail, isBookable: false, salesState: "NOT_OPEN", salesOpenAt: "2026-10-14T09:00:00.000Z" }) as { offers: Record<string, unknown> };
  assert.equal(soon.offers.availability, "https://schema.org/PreOrder");
  assert.equal(soon.offers.validFrom, "2026-10-14T09:00:00.000Z");
  assert.equal(matchJsonLd({ ...detail, isTicketable: false }).offers, undefined);
  assert.equal(matchJsonLd({ ...detail, isBookable: false, salesState: "CLOSED" }).offers, undefined);
  const hostile = jsonLdScript(matchJsonLd({ ...detail, opponent: { ...detail.opponent, nameAr: "</script><script>alert(1)</script>" } }));
  assert.equal(hostile.includes("</script>"), false);
});

test("sitemap lists /matches and each ticketed match", () => {
  const now = new Date("2026-10-12T00:00:00.000Z");
  const entries = matchSitemapEntries([{ id: ID, date: detail.date, opponent: detail.opponent, stadiumAr: "", stadiumEn: "", competitionAr: null, salesState: "OPEN", salesOpenAt: null, minPrice: null }], now);
  assert.deepEqual(entries.map((entry) => entry.url), ["https://store.alansar.sa/matches", `https://store.alansar.sa/matches/${ID}`]);
});
