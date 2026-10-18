/**
 * Season-pass seat map on the storefront (web-season-pass 2026-10-14). Pure
 * helpers: parse web-api's seat-map and seats payloads, compute SVG geometry,
 * and apply the selection rules. The component is components/season-seat-picker.tsx.
 */

/** Canvas the admin venue workspace stores section geometry in (absolute coordinates). */
export const CANVAS_W = 960;
export const CANVAS_H = 640;
/** Pitch rectangle, centred in the canvas (same as the app's stadium overview). */
export const PITCH = { x: 362, y: 232, w: 236, h: 176 } as const;
/** Seat grid: one cell per seat, a left gutter for row labels. */
export const SEAT_GAP = 26;
export const SEAT_RADIUS = 10;
export const ROW_LABEL_W = 36;

export type SeatStatus = "AVAILABLE" | "TAKEN_BY_PASS" | "BLOCKED";
export type Point = { x: number; y: number };
export type MapSection = {
  id: string;
  name: string;
  color: string;
  gate: string | null;
  /** SVG `points` attribute for a polygon section, else null. */
  points: string | null;
  /** Geometry for a rectangle section, else null. Both null = no geometry (listed as a button instead). */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Where the available-count label is drawn. */
  label: Point;
  available: number;
  total: number;
};
export type LegendEntry = { label: string; color: string };
export type SeatMap = { venueName: string; sections: MapSection[]; legend: LegendEntry[] };
export type Seat = { id: string; row: string; number: number; x: number; y: number; status: SeatStatus; accessible: boolean };
/** What the page answers when the picker confirms seats. */
export type SeatConfirmResult =
  | { kind: "done" }
  | { kind: "conflict"; takenSeatIds: string[] }
  | { kind: "error"; message: string };

/** Mirrors web-api's legend (seat-map route) and the app's seat-map palette. */
export const SEAT_STATUS_COLOR: Record<SeatStatus, string> = {
  AVAILABLE: "#2ECC71",
  TAKEN_BY_PASS: "#9333EA",
  BLOCKED: "#555555",
};

const FALLBACK_COLOR = "#17533d";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{3,8}$/i;
const STATUSES = new Set<SeatStatus>(["AVAILABLE", "TAKEN_BY_PASS", "BLOCKED"]);

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const color = (value: unknown): string | null => (typeof value === "string" && HEX.test(value) ? value : null);

function toPoints(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const points: Point[] = [];
  for (const item of value) {
    if (!isRow(item)) return null;
    const x = num(item.x);
    const y = num(item.y);
    if (x === null || y === null) return null;
    points.push({ x, y });
  }
  return points;
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function toSection(row: unknown): MapSection | null {
  if (!isRow(row) || typeof row.id !== "string" || !UUID.test(row.id)) return null;
  const geo = isRow(row.geo) ? row.geo : null;
  const tier = isRow(row.tier) ? row.tier : null;
  const counts = isRow(row.counts) ? row.counts : null;
  const points = toPoints(geo?.points);
  const x = num(geo?.x);
  const y = num(geo?.y);
  const w = num(geo?.w);
  const h = num(geo?.h);
  const rect = !points && x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0 ? { x, y, w, h } : null;
  const label = points ? centroid(points) : rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : { x: CANVAS_W / 2, y: 40 };
  return {
    id: row.id,
    name: str(row.name_ar) ?? str(row.name_en) ?? "",
    color: color(tier?.color) ?? color(geo?.color) ?? FALLBACK_COLOR,
    gate: str(row.gate),
    points: points ? points.map((p) => `${p.x},${p.y}`).join(" ") : null,
    rect,
    label,
    available: Math.max(0, num(counts?.available) ?? 0),
    total: Math.max(0, num(counts?.total) ?? 0),
  };
}

/** web-api GET …/tiers/{tierId}/seat-map `data` → SeatMap. null when the payload is not a map. */
export function toSeatMap(data: unknown): SeatMap | null {
  if (!isRow(data) || !Array.isArray(data.sections)) return null;
  const venue = isRow(data.venue) ? data.venue : {};
  const legend = (Array.isArray(data.legend) ? data.legend : [])
    .filter(isRow)
    .map((entry) => ({ label: str(entry.label_ar) ?? str(entry.label_en) ?? "", color: color(entry.color) }))
    .filter((entry): entry is LegendEntry => entry.label !== "" && entry.color !== null);
  return {
    venueName: str(venue.name_ar) ?? str(venue.name_en) ?? "",
    sections: data.sections.map(toSection).filter((section): section is MapSection => section !== null),
    legend,
  };
}

function toSeat(row: unknown): Seat | null {
  if (!isRow(row) || typeof row.id !== "string" || !UUID.test(row.id)) return null;
  const number = num(row.seat_number);
  const x = num(row.x);
  const y = num(row.y);
  const status = typeof row.status === "string" && STATUSES.has(row.status as SeatStatus) ? (row.status as SeatStatus) : null;
  if (number === null || x === null || y === null || x < 0 || y < 0 || !status) return null;
  return { id: row.id, row: str(row.row_label) ?? "", number, x, y, status, accessible: row.is_accessible === true };
}

/** web-api GET …/sections/{sectionId}/seats `data` → Seat[] (malformed rows dropped). */
export function toSectionSeats(data: unknown): Seat[] {
  if (!isRow(data) || !Array.isArray(data.seats)) return [];
  return data.seats.map(toSeat).filter((seat): seat is Seat => seat !== null);
}

export function seatCenter(seat: Pick<Seat, "x" | "y">): Point {
  return { x: ROW_LABEL_W + seat.x * SEAT_GAP + SEAT_GAP / 2, y: seat.y * SEAT_GAP + SEAT_GAP / 2 };
}

/** viewBox size for a section's seat grid. */
export function sectionBox(seats: Pick<Seat, "x" | "y">[]): { width: number; height: number } {
  if (seats.length === 0) return { width: ROW_LABEL_W + SEAT_GAP, height: SEAT_GAP };
  const maxX = Math.max(...seats.map((s) => s.x));
  const maxY = Math.max(...seats.map((s) => s.y));
  return { width: ROW_LABEL_W + (maxX + 1) * SEAT_GAP, height: (maxY + 1) * SEAT_GAP };
}

/** One label per row, at that row's first seat's height, top to bottom. */
export function rowLabels(seats: Seat[]): { row: string; y: number }[] {
  const byRow = new Map<string, number>();
  for (const seat of seats) if (!byRow.has(seat.row)) byRow.set(seat.row, seatCenter(seat).y);
  return [...byRow].map(([row, y]) => ({ row, y })).sort((a, b) => a.y - b.y);
}

/** Text alternative to the grid: rows that still have AVAILABLE seats, top to bottom, seats by number. */
export function availableRows(seats: Seat[]): { row: string; seats: Seat[] }[] {
  const byRow = new Map<string, Seat[]>();
  for (const seat of seats) {
    if (seat.status !== "AVAILABLE") continue;
    const list = byRow.get(seat.row) ?? [];
    list.push(seat);
    byRow.set(seat.row, list);
  }
  return [...byRow]
    .map(([row, list]) => ({ row, seats: [...list].sort((a, b) => a.number - b.number) }))
    .sort((a, b) => a.seats[0].y - b.seats[0].y || a.row.localeCompare(b.row));
}

/**
 * Selection rule (same as the app): a second tap removes a seat; only AVAILABLE
 * seats can be added; with max 1 a new seat replaces the old one; otherwise
 * seats are added until `max`.
 */
export function toggleSeat(selected: string[], seat: Pick<Seat, "id" | "status">, max: number): string[] {
  if (selected.includes(seat.id)) return selected.filter((id) => id !== seat.id);
  if (seat.status !== "AVAILABLE") return selected;
  if (max <= 1) return [seat.id];
  if (selected.length >= max) return selected;
  return [...selected, seat.id];
}

/** After a 409 SEASON_SEAT_CONFLICT: drop the taken seats; without a list, clear everything (as the app does). */
export function dropTakenSeats(selected: string[], taken: string[]): string[] {
  return taken.length === 0 ? [] : selected.filter((id) => !taken.includes(id));
}

export function seatLabel(seat: Pick<Seat, "row" | "number">): string {
  return `الصف ${seat.row} · المقعد ${seat.number}`;
}
