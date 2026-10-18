"use client";

import { useState } from "react";
import { cancellationReasonLabel } from "@/lib/event-booking";

type Eligibility = {
  mode: "self_service" | "approval_required" | "ineligible";
  eligible: boolean;
  refundAmountHalalah: number | null;
  reason: string | null;
  pendingRequestId: string | null;
};
const money = (halalah: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س`;

/** Cancel/refund an event booking: checks eligibility first, then confirms with the shopper. */
export function EventCancel({ subscriptionId, onDone }: { subscriptionId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "checking" | "confirm" | "busy" | "done">("idle");
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [message, setMessage] = useState("");
  const url = `/api/event-bookings/${subscriptionId}/cancellation`;

  const check = async () => {
    setState("checking"); setMessage("");
    const body = await fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Eligibility | null;
    if (!body) { setState("idle"); setMessage("تعذّر التحقق الآن. حاول بعد قليل."); return; }
    setEligibility(body);
    if (body.pendingRequestId) { setState("confirm"); return; }
    if (body.mode === "ineligible") { setState("idle"); setMessage(cancellationReasonLabel(body.reason)); return; }
    setState("confirm");
  };

  const confirm = async () => {
    setState("busy");
    const pending = eligibility?.pendingRequestId;
    const response = pending
      ? await fetch(`${url}?request=${pending}`, { method: "DELETE" }).catch(() => null)
      : await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const body = await response?.json().catch(() => ({})) as { result?: string; reason?: string | null } | undefined;
    if (!response?.ok) {
      setState("idle");
      setMessage(response?.status === 409 ? cancellationReasonLabel(body?.reason ?? null) : "تعذّر الإلغاء الآن. حاول بعد قليل.");
      return;
    }
    setState("done");
    setMessage(body?.result === "WITHDRAWN" ? "سحبنا طلب الإلغاء." : body?.result === "PENDING" ? "استلمنا طلب الإلغاء وسنراجعه قريبًا." : "ألغينا حجزك.");
    onDone();
  };

  if (state === "done") return <p className="ev-note" role="status">{message}</p>;
  return <div className="ev-cancel">
    {state === "confirm" && eligibility
      ? <>
          <p>{eligibility.pendingRequestId
            ? "لديك طلب إلغاء قيد المراجعة. هل تريد سحبه؟"
            : eligibility.refundAmountHalalah
              ? `سنلغي الحجز ونسترد ${money(eligibility.refundAmountHalalah)} إلى وسيلة الدفع نفسها.`
              : "سنلغي الحجز وتُلغى تذاكره."}</p>
          <button type="button" className="button button-primary" onClick={confirm}>{eligibility.pendingRequestId ? "سحب الطلب" : "تأكيد الإلغاء"}</button>
          <button type="button" className="text-button" onClick={() => setState("idle")}>تراجع</button>
        </>
      : <button type="button" className="text-button ev-cancel-btn" onClick={check} disabled={state !== "idle"}>
          {state === "checking" || state === "busy" ? "لحظة…" : "إلغاء الحجز"}
        </button>}
    {message && <p className="ev-note" role="alert">{message}</p>}
  </div>;
}
