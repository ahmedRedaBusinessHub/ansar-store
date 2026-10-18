import test from "node:test";
import assert from "node:assert/strict";
import {
  availableRows, dropTakenSeats, ROW_LABEL_W, rowLabels, SEAT_GAP, seatCenter, seatLabel, sectionBox,
  toggleSeat, toSeatMap, toSectionSeats, type Seat,
} from "../lib/seat-map";

const V = "10000000-0000-4000-8000-000000000000";
const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";
const C = "a0000000-0000-4000-8000-000000000003";
const S1 = "b0000000-0000-4000-8000-000000000001";
const S2 = "b0000000-0000-4000-8000-000000000002";
const S3 = "b0000000-0000-4000-8000-000000000003";
const S4 = "b0000000-0000-4000-8000-000000000004";
const S5 = "b0000000-0000-4000-8000-000000000005";
const S6 = "b0000000-0000-4000-8000-000000000006";
const S7 = "b0000000-0000-4000-8000-000000000007";

const tier = (color: string) => ({ venue_tier_id: "t", name_ar: "ذهبي", name_en: "Gold", color, rank: 1 });
const counts = (available: number) => ({ total: 100, taken_by_pass: 0, blocked: 0, available });

test("toSeatMap: polygon, rect and geometry-less sections; colours are validated", () => {
  const map = toSeatMap({
    venue: { id: V, name_ar: "ملعب الأنصار", name_en: "Ansar", pitch_side: "TOP" },
    sections: [
      { id: A, name_ar: "الشرقي", name_en: "East", kind: "SEATED", gate: "1",
        geo: { x: null, y: null, w: null, h: null, points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }], color: null },
        tier: tier("#AA8800"), counts: counts(90) },
      { id: B, name_ar: "الغربي", name_en: "West", kind: "SEATED", gate: null,
        geo: { x: 100, y: 50, w: 40, h: 20, points: null, color: "#112233" },
        tier: tier("javascript:alert(1)"), counts: counts(0) },
      { id: C, name_ar: "الشمالي", name_en: "North", kind: "SEATED", gate: null, geo: null, tier: tier("#00ff00"), counts: counts(5) },
      { id: "bad" },
    ],
    legend: [{ label_ar: "متاح", label_en: "Available", color: "#2ECC71" }, { label_ar: "x", label_en: "x", color: "red;" }],
  });
  assert.ok(map);
  assert.equal(map.venueName, "ملعب الأنصار");
  assert.equal(map.sections.length, 3);
  const [a, b, c] = map.sections;
  assert.equal(a.points, "0,0 30,0 30,30 0,30");
  assert.equal(a.rect, null);
  assert.deepEqual(a.label, { x: 15, y: 15 });
  assert.equal(a.color, "#AA8800");
  assert.equal(a.available, 90);
  assert.equal(a.gate, "1");
  assert.deepEqual(b.rect, { x: 100, y: 50, w: 40, h: 20 });
  assert.deepEqual(b.label, { x: 120, y: 60 });
  assert.equal(b.color, "#112233");
  assert.equal(b.available, 0);
  assert.equal(c.points, null);
  assert.equal(c.rect, null);
  assert.equal(c.color, "#00ff00");
  assert.deepEqual(map.legend, [{ label: "متاح", color: "#2ECC71" }]);
  assert.equal(toSeatMap(null), null);
  assert.equal(toSeatMap({ sections: "x" }), null);
});

const rawSeats = [
  { id: S1, row_label: "A", seat_number: 1, x: 0, y: 0, status: "AVAILABLE", is_accessible: false, accessible_kind: null },
  { id: S2, row_label: "A", seat_number: 2, x: 1, y: 0, status: "TAKEN_BY_PASS", is_accessible: true, accessible_kind: "WHEELCHAIR" },
  { id: S3, row_label: "B", seat_number: 1, x: 0, y: 1, status: "BLOCKED", is_accessible: false, accessible_kind: null },
  { id: "bad", row_label: "B", seat_number: 2, x: 1, y: 1, status: "AVAILABLE" },
  { id: S4, row_label: "B", seat_number: 2, x: 1, y: 1, status: "HELD" },
];

test("toSectionSeats keeps valid seats only", () => {
  const seats = toSectionSeats({ section_id: A, seats: rawSeats });
  assert.deepEqual(seats.map((s) => s.id), [S1, S2, S3]);
  assert.deepEqual(seats[1], { id: S2, row: "A", number: 2, x: 1, y: 0, status: "TAKEN_BY_PASS", accessible: true });
  assert.deepEqual(toSectionSeats(null), []);
  assert.deepEqual(toSectionSeats({ seats: "x" }), []);
});

test("seat geometry", () => {
  const seats = toSectionSeats({ seats: rawSeats });
  assert.deepEqual(seatCenter({ x: 0, y: 0 }), { x: ROW_LABEL_W + SEAT_GAP / 2, y: SEAT_GAP / 2 });
  assert.deepEqual(seatCenter({ x: 2, y: 1 }), { x: ROW_LABEL_W + 2 * SEAT_GAP + SEAT_GAP / 2, y: SEAT_GAP + SEAT_GAP / 2 });
  assert.deepEqual(sectionBox(seats), { width: ROW_LABEL_W + 2 * SEAT_GAP, height: 2 * SEAT_GAP });
  assert.deepEqual(sectionBox([]), { width: ROW_LABEL_W + SEAT_GAP, height: SEAT_GAP });
  assert.deepEqual(rowLabels(seats), [{ row: "A", y: SEAT_GAP / 2 }, { row: "B", y: SEAT_GAP + SEAT_GAP / 2 }]);
});

const seat = (id: string, row: string, number: number, x: number, y: number, status: Seat["status"] = "AVAILABLE"): Seat =>
  ({ id, row, number, x, y, status, accessible: false });

test("availableRows lists AVAILABLE seats only, rows top to bottom, seats by number", () => {
  const rows = availableRows([
    seat(S1, "A", 3, 2, 0), seat(S2, "A", 1, 0, 0), seat(S3, "A", 2, 1, 0, "BLOCKED"),
    seat(S4, "C", 2, 1, 2), seat(S5, "C", 1, 0, 2), seat(S6, "B", 1, 0, 1, "TAKEN_BY_PASS"),
  ]);
  assert.deepEqual(rows.map((r) => r.row), ["A", "C"]);
  assert.deepEqual(rows[0].seats.map((s) => s.number), [1, 3]);
  assert.deepEqual(rows[1].seats.map((s) => s.number), [1, 2]);
});

test("toggleSeat: single-seat replaces, multi-seat appends up to max, removes on second tap, ignores unavailable", () => {
  const free = seat(S1, "A", 1, 0, 0);
  const free2 = seat(S2, "A", 2, 1, 0);
  const taken = seat(S3, "A", 3, 2, 0, "TAKEN_BY_PASS");
  assert.deepEqual(toggleSeat([], free, 1), [S1]);
  assert.deepEqual(toggleSeat([S1], free2, 1), [S2]);
  assert.deepEqual(toggleSeat([S1], free, 1), []);
  assert.deepEqual(toggleSeat([S1], free2, 3), [S1, S2]);
  assert.deepEqual(toggleSeat([S1, S2], seat(S7, "A", 9, 8, 0), 2), [S1, S2]);
  assert.deepEqual(toggleSeat([S1], taken, 3), [S1]);
  assert.deepEqual(toggleSeat([S3], taken, 3), []);
});

test("dropTakenSeats: removes taken ids; an empty list clears the selection", () => {
  assert.deepEqual(dropTakenSeats([S1, S2], [S2]), [S1]);
  assert.deepEqual(dropTakenSeats([S1, S2], []), []);
});

test("seatLabel", () => {
  assert.equal(seatLabel({ row: "A", number: 1 }), "الصف A · المقعد 1");
});
