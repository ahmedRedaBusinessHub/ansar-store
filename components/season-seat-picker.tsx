"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Minus, Plus, X } from "lucide-react";
import { formatSectionPrice } from "@/lib/matches";
import { maxPassQuantity, type SeasonTier } from "@/lib/season-pass";
import {
  availableRows, CANVAS_H, CANVAS_W, dropTakenSeats, PITCH, ROW_LABEL_W, rowLabels, SEAT_RADIUS, SEAT_STATUS_COLOR,
  seatCenter, seatLabel, sectionBox, toggleSeat, type MapSection, type Seat, type SeatConfirmResult, type SeatMap,
} from "@/lib/seat-map";
import "./season-seat-picker.css";

const ZOOMS = [1, 1.5, 2, 3] as const;
const PICKED_COLOR = "#b58a2c";
const CONFLICT_MESSAGE = "سبقك أحد إلى هذا المقعد، اختر مقعدًا آخر.";

export type SeasonSeatPickerProps = {
  tier: SeasonTier;
  onConfirm: (seatIds: string[]) => Promise<SeatConfirmResult>;
  onClose: () => void;
};

/** Stadium overview → section → seat, for a SEAT tier. Same selection rules as the app (lib/seat-map.ts). */
export function SeasonSeatPicker({ tier, onConfirm, onClose }: SeasonSeatPickerProps) {
  const maxSeats = maxPassQuantity(tier);
  const [map, setMap] = useState<SeatMap | null>(null);
  const [mapError, setMapError] = useState("");
  const [section, setSection] = useState<MapSection | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [seatsError, setSeatsError] = useState("");
  const [picked, setPicked] = useState<Seat[]>([]);
  const [zoom, setZoom] = useState(0);
  const [row, setRow] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadMap = useCallback(async () => {
    setMapError("");
    try {
      const response = await fetch(`/api/season-pass/tiers/${tier.id}/seat-map`, { cache: "no-store" });
      if (response.status === 401) { setMapError("سجّل الدخول لاختيار مقعدك."); return; }
      if (!response.ok) { setMapError("تعذّر تحميل خريطة الملعب. حاول مجددًا."); return; }
      const body = await response.json();
      setMap(body.map as SeatMap);
    } catch {
      setMapError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا.");
    }
  }, [tier.id]);

  const loadSeats = useCallback(async (sectionId: string) => {
    setSeats(null);
    setSeatsError("");
    try {
      const response = await fetch(`/api/season-pass/tiers/${tier.id}/sections/${sectionId}/seats`, { cache: "no-store" });
      if (!response.ok) { setSeatsError("تعذّر تحميل المقاعد. حاول مجددًا."); return; }
      const body = await response.json();
      setSeats(Array.isArray(body.seats) ? (body.seats as Seat[]) : []);
    } catch {
      setSeatsError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا.");
    }
  }, [tier.id]);

  useEffect(() => { void loadMap(); }, [loadMap]);

  const openSection = (next: MapSection) => {
    if (next.available === 0) return;
    setSection(next);
    setRow("");
    setZoom(0);
    setMessage("");
    void loadSeats(next.id);
  };

  const toggle = (seat: Seat) => setPicked((current) => {
    const ids = toggleSeat(current.map((s) => s.id), seat, maxSeats);
    return ids.map((id) => current.find((s) => s.id === id) ?? seat);
  });

  const confirm = async () => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setMessage("");
    const result = await onConfirm(picked.map((s) => s.id));
    setBusy(false);
    if (result.kind === "conflict") {
      setPicked((current) => {
        const keep = dropTakenSeats(current.map((s) => s.id), result.takenSeatIds);
        return current.filter((s) => keep.includes(s.id));
      });
      setMessage(CONFLICT_MESSAGE);
      void loadMap();
      if (section) void loadSeats(section.id);
    } else if (result.kind === "error") {
      setMessage(result.message);
    }
  };

  const drawable = map ? map.sections.filter((s) => s.points !== null || s.rect !== null) : [];
  const others = map ? map.sections.filter((s) => s.points === null && s.rect === null) : [];
  const rows = seats ? availableRows(seats) : [];
  const rowSeats = rows.find((r) => r.row === row)?.seats ?? [];
  const box = seats ? sectionBox(seats) : null;
  const scale = ZOOMS[zoom];
  const pickedIds = picked.map((s) => s.id);

  return <div className="ssp">
    <div className="ssp-head">
      <h4>{section ? section.name : "اختر المدرج"}</h4>
      <button type="button" className="text-button" onClick={section ? () => setSection(null) : onClose}>
        {section ? "كل المدرجات" : "إغلاق الخريطة"}
      </button>
    </div>

    {mapError && <div className="ssp-error" role="alert">
      <p>{mapError}</p>
      <button type="button" className="text-button" onClick={() => void loadMap()}>إعادة المحاولة</button>
    </div>}
    {!map && !mapError && <p role="status">نحمّل خريطة الملعب…</p>}

    {map && !section && <>
      <p className="ssp-hint">اضغط على المدرج لعرض مقاعده. الرقم على كل مدرج هو عدد المقاعد المتاحة.</p>
      <svg className="ssp-overview" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} role="group" aria-label={`خريطة ${map.venueName}`}>
        <rect x={PITCH.x} y={PITCH.y} width={PITCH.w} height={PITCH.h} rx={10} className="ssp-pitch" />
        <text x={PITCH.x + PITCH.w / 2} y={PITCH.y + PITCH.h / 2} className="ssp-pitch-label" textAnchor="middle" dominantBaseline="middle">الملعب</text>
        {drawable.map((s) => {
          const disabled = s.available === 0;
          const shape = {
            className: `ssp-section${disabled ? " is-disabled" : ""}`,
            fill: s.color,
            role: "button",
            tabIndex: disabled ? -1 : 0,
            "aria-label": `${s.name}، ${disabled ? "لا مقاعد متاحة" : `${s.available} مقعد متاح`}`,
            "aria-disabled": disabled,
            onClick: () => openSection(s),
            onKeyDown: (event: KeyboardEvent<SVGElement>) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSection(s); }
            },
          };
          return <g key={s.id}>
            {s.points
              ? <polygon points={s.points} {...shape} />
              : s.rect ? <rect x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h} {...shape} /> : null}
            <text x={s.label.x} y={s.label.y} className="ssp-section-label" textAnchor="middle" dominantBaseline="middle" aria-hidden="true">{s.available}</text>
          </g>;
        })}
      </svg>
      {others.length > 0 && <div className="ssp-others">
        <span>مدرجات أخرى:</span>
        {others.map((s) => <button key={s.id} type="button" className="ssp-chip" disabled={s.available === 0} onClick={() => openSection(s)}>
          {s.name} ({s.available})
        </button>)}
      </div>}
    </>}

    {map && section && <>
      {seatsError && <div className="ssp-error" role="alert">
        <p>{seatsError}</p>
        <button type="button" className="text-button" onClick={() => void loadSeats(section.id)}>إعادة المحاولة</button>
      </div>}
      {!seats && !seatsError && <p role="status">نحمّل المقاعد…</p>}
      {seats && box && <>
        <div className="ssp-toolbar">
          <span className="ssp-pitch-banner">⚽ جهة الملعب</span>
          <div className="ssp-zoom">
            <button type="button" aria-label="تصغير" title="تصغير" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0}><Minus size={16} /></button>
            <button type="button" aria-label="تكبير" title="تكبير" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1}><Plus size={16} /></button>
          </div>
        </div>
        <div className="ssp-frame">
          <svg className="ssp-seats" viewBox={`0 0 ${box.width} ${box.height}`}
            style={{ width: `${Math.round(box.width * scale)}px`, maxWidth: zoom === 0 ? "100%" : "none" }} aria-hidden="true">
            {rowLabels(seats).map((r) => <text key={r.row} x={ROW_LABEL_W / 2} y={r.y} className="ssp-row-label" textAnchor="middle" dominantBaseline="middle">{r.row}</text>)}
            {seats.map((seat) => {
              const center = seatCenter(seat);
              const isPicked = pickedIds.includes(seat.id);
              const can = seat.status === "AVAILABLE";
              return <g key={seat.id} className={`ssp-seat${can ? " is-available" : ""}${isPicked ? " is-picked" : ""}`}
                onClick={() => { if (can || isPicked) toggle(seat); }}>
                <circle cx={center.x} cy={center.y} r={SEAT_RADIUS} fill={isPicked ? PICKED_COLOR : SEAT_STATUS_COLOR[seat.status]} />
                {seat.accessible && <text x={center.x} y={center.y} className="ssp-access" textAnchor="middle" dominantBaseline="central">♿</text>}
                <title>{seatLabel(seat)}</title>
              </g>;
            })}
          </svg>
        </div>
        <ul className="ssp-legend">
          {map.legend.map((entry) => <li key={entry.label}><span style={{ background: entry.color }} aria-hidden="true" />{entry.label}</li>)}
          <li><span style={{ background: PICKED_COLOR }} aria-hidden="true" />اختيارك</li>
        </ul>
        <div className="ssp-fallback">
          <label>الصف
            <select value={row} onChange={(event) => setRow(event.target.value)}>
              <option value="">اختر الصف</option>
              {rows.map((r) => <option key={r.row} value={r.row}>{r.row}</option>)}
            </select>
          </label>
          <label>المقعد
            <select value="" disabled={!row} onChange={(event) => {
              const chosen = rowSeats.find((s) => s.id === event.target.value);
              if (chosen) toggle(chosen);
            }}>
              <option value="">اختر المقعد</option>
              {rowSeats.map((s) => <option key={s.id} value={s.id}>{s.number}{pickedIds.includes(s.id) ? " ✓" : ""}</option>)}
            </select>
          </label>
        </div>
      </>}
    </>}

    {picked.length > 0 && <ul className="ssp-picked" aria-label="المقاعد المختارة">
      {picked.map((s) => <li key={s.id}>
        {seatLabel(s)}
        <button type="button" aria-label={`إزالة ${seatLabel(s)}`} title="إزالة" onClick={() => toggle(s)}><X size={14} /></button>
      </li>)}
    </ul>}
    {message && <p className="ssp-error" role="alert">{message}</p>}

    <div className="ssp-bar">
      <span>{maxSeats === 1 ? "مقعد واحد لكل عملية شراء" : `حتى ${maxSeats} مقاعد`}</span>
      {picked.length > 0 && <b>{formatSectionPrice(Math.round(tier.price * picked.length * 100) / 100)}</b>}
      <button type="button" className="button button-primary" disabled={picked.length === 0 || busy} onClick={() => void confirm()}>
        {busy ? "نجهّز حجزك…" : tier.price === 0 ? "احجز مجانًا" : "أكمل الحجز"}
      </button>
    </div>
  </div>;
}
