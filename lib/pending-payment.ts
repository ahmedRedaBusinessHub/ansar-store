import type { CheckoutResult } from "./types";

export type PendingPayment = NonNullable<CheckoutResult["payment"]>;
export const PENDING_PAYMENT_KEY = "ansar-store:pending-payment";

export function savePendingPayment(payment: PendingPayment): void {
  try { sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment)); } catch { /* storage denied: pay page will re-create the intent */ }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw || raw.length > 10_000) return null;
    const value = JSON.parse(raw) as PendingPayment;
    return typeof value?.paymentId === "string" && Number.isSafeInteger(value.amountHalalah) && value.amountHalalah > 0 ? value : null;
  } catch {
    return null;
  }
}
