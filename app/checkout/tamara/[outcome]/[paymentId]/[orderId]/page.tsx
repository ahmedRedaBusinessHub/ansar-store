import { notFound, redirect } from "next/navigation";
import "../../../../checkout.css";
import "../../../../../account.css";

export const metadata = { title: "تمارا | متجر الأنصار", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["success", "failure", "cancel"]);

// Tamara sends the shopper here (URLs built by web-api from TAMARA_WEB_RETURN_URL_BASE). Its own query string is ignored:
// success goes to the normal result page, which asks web-api (not the URL) whether the payment settled.
export default async function TamaraReturnPage({ params }: { params: Promise<{ outcome: string; paymentId: string; orderId: string }> }) {
  const { outcome, paymentId, orderId } = await params;
  if (!OUTCOMES.has(outcome) || !UUID.test(paymentId) || !UUID.test(orderId)) notFound();
  if (outcome === "success") redirect(`/checkout/result?payment=${paymentId}&order=${orderId}`);
  const cancelled = outcome === "cancel";
  return <main className="co-shell" dir="rtl">
    <div className="co-card">
      <h1>{cancelled ? "ألغيت الدفع عبر تمارا" : "لم تكتمل الموافقة من تمارا"}</h1>
      <p className="acc-note">{cancelled ? "لم يُخصم أي مبلغ. يمكنك اختيار طريقة دفع أخرى." : "لم يُخصم أي مبلغ. جرّب طريقة دفع أخرى أو حاول مجددًا لاحقًا."}</p>
      <a className="acc-primary" href={`/checkout/pay?order=${orderId}`}>اختر طريقة دفع أخرى</a>
      <a className="co-back" href="/orders">طلباتي</a>
    </div>
  </main>;
}
