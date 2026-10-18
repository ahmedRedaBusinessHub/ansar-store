/**
 * Where a shopper returning from Tamara goes. web-api builds the return URL as
 * /checkout/tamara/{outcome}/{paymentId}/{entityId} for store orders, season passes,
 * and event bookings alike, so the page asks web-api which kind of payment it is.
 */
export type TamaraOutcome = "success" | "failure" | "cancel";
export type PaymentEntityRef = { entityType: string; entityId: string };
export type TamaraReturnAction =
  | { kind: "redirect"; to: string }
  | { kind: "retry"; outcome: "failure" | "cancel"; retryHref: string; backHref: string; backLabel: string }
  | { kind: "neutral" };

export function tamaraReturnAction(
  outcome: TamaraOutcome,
  paymentId: string,
  entityId: string,
  payment: PaymentEntityRef | null,
): TamaraReturnAction {
  if (!payment || payment.entityId !== entityId) return { kind: "neutral" };
  if (payment.entityType === "ORDER") {
    if (outcome === "success") return { kind: "redirect", to: `/checkout/result?payment=${paymentId}&order=${entityId}` };
    return { kind: "retry", outcome, retryHref: `/checkout/pay?order=${entityId}`, backHref: "/orders", backLabel: "طلباتي" };
  }
  if (payment.entityType === "SEASON_PASS") {
    if (outcome === "success") return { kind: "redirect", to: `/checkout/tickets/result?payment=${paymentId}&pass=${entityId}` };
    return { kind: "retry", outcome, retryHref: `/checkout/tickets/pay?pass=${entityId}`, backHref: "/tickets", backLabel: "تذاكري" };
  }
  if (payment.entityType === "EVENT") {
    if (outcome === "success") return { kind: "redirect", to: `/checkout/tickets/result?payment=${paymentId}&event=${entityId}` };
    return { kind: "retry", outcome, retryHref: `/checkout/tickets/pay?event=${entityId}`, backHref: "/tickets", backLabel: "تذاكري" };
  }
  return { kind: "neutral" };
}
