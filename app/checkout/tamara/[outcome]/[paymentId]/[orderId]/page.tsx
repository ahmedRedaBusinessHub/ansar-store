import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";
import { tamaraReturnAction, type PaymentEntityRef, type TamaraOutcome } from "@/lib/tamara-return";
import { upstream } from "@/lib/upstream";
import "../../../../checkout.css";
import "../../../../../account.css";

export const metadata = { title: "تمارا | متجر الأنصار", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["success", "failure", "cancel"]);

/** Which entity this payment is for, asked of web-api with the shopper's session. null when unknown. */
async function lookupPayment(paymentId: string): Promise<PaymentEntityRef | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length >= 4096) return null;
  try {
    const { data } = await upstream<{ entity_type?: unknown; entity_id?: unknown } | null>(`/api/v2/payments/${paymentId}`, { token });
    return typeof data?.entity_type === "string" && typeof data?.entity_id === "string"
      ? { entityType: data.entity_type, entityId: data.entity_id }
      : null;
  } catch {
    return null;
  }
}

// Tamara sends the shopper here (URLs built by web-api from TAMARA_WEB_RETURN_URL_BASE). Its own query string is ignored:
// success goes to the result page, which asks web-api (not the URL) whether the payment settled.
// The last segment is named [orderId] for history; it holds a store-order id or a season-pass id.
export default async function TamaraReturnPage({ params }: { params: Promise<{ outcome: string; paymentId: string; orderId: string }> }) {
  const { outcome, paymentId, orderId: entityId } = await params;
  if (!OUTCOMES.has(outcome) || !UUID.test(paymentId) || !UUID.test(entityId)) notFound();
  const action = tamaraReturnAction(outcome as TamaraOutcome, paymentId, entityId, await lookupPayment(paymentId));
  if (action.kind === "redirect") redirect(action.to);
  if (action.kind === "neutral") {
    return <main className="co-shell" dir="rtl">
      <div className="co-card">
        <h1>عدت من تمارا</h1>
        <p className="acc-note">لم نتمكن من التحقق من حالة الدفع هنا. تابعها من صفحة طلباتك أو تذاكرك.</p>
        <a className="acc-primary" href="/orders">طلباتي</a>
        <a className="co-back" href="/tickets">تذاكري</a>
      </div>
    </main>;
  }
  const cancelled = action.outcome === "cancel";
  return <main className="co-shell" dir="rtl">
    <div className="co-card">
      <h1>{cancelled ? "ألغيت الدفع عبر تمارا" : "لم تكتمل الموافقة من تمارا"}</h1>
      <p className="acc-note">{cancelled ? "لم يُخصم أي مبلغ. يمكنك اختيار طريقة دفع أخرى." : "لم يُخصم أي مبلغ. جرّب طريقة دفع أخرى أو حاول مجددًا لاحقًا."}</p>
      <a className="acc-primary" href={action.retryHref}>اختر طريقة دفع أخرى</a>
      <a className="co-back" href={action.backHref}>{action.backLabel}</a>
    </div>
  </main>;
}
