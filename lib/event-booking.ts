import type { EventBookingStatus, NotBookableReason } from "./events";

export type EventBookingErrorView = { message: string; clampTo: number | null; showTicketsLink: boolean; externalUrl: string | null };

export function eventBookingErrorView(code: string | null | undefined, available: number | null, externalUrl: string | null): EventBookingErrorView {
  const base = { clampTo: null, showTicketsLink: false, externalUrl: null };
  switch (code) {
    case "EVENT_FULLY_BOOKED":
      return { ...base, message: "اكتمل الحجز لهذه الفعالية." };
    case "INSUFFICIENT_SLOTS":
      return available !== null && available > 0
        ? { ...base, message: `متبقٍ ${available} فقط. عدّلنا العدد لك.`, clampTo: available }
        : { ...base, message: "اكتمل الحجز لهذه الفعالية." };
    case "ALREADY_SUBSCRIBED":
      return { ...base, message: "لديك حجز لهذه الفعالية.", showTicketsLink: true };
    case "EXTERNAL_BOOKING_ONLY":
      return { ...base, message: "يتم الحجز لهذه الفعالية من موقع المنظّم.", externalUrl };
    case "rate_limited":
    case "RATE_LIMIT_EXCEEDED":
      return { ...base, message: "محاولات كثيرة، حاول بعد قليل." };
    case "INVALID_STATUS":
      return { ...base, message: "لا يمكن إضافة تذاكر لهذا الحجز الآن.", showTicketsLink: true };
    case "EVENT_PAST":
      return { ...base, message: "انتهت هذه الفعالية." };
    default:
      return { ...base, message: "تعذّر إتمام الحجز الآن. حاول مجددًا." };
  }
}

export function eventPayHref(subscriptionId: string, eventId: string, holdExpiresAt: string | null): string {
  const params = new URLSearchParams({ event: subscriptionId, e: eventId });
  if (holdExpiresAt) params.set("expires", holdExpiresAt);
  return `/checkout/tickets/pay?${params.toString()}`;
}

export function eventAddPayHref(subscriptionId: string, paymentId: string, eventId: string): string {
  return `/checkout/tickets/pay?${new URLSearchParams({ event: subscriptionId, add: paymentId, e: eventId }).toString()}`;
}

export function notBookableLabel(reason: NotBookableReason, myStatus: EventBookingStatus | null): string {
  switch (reason) {
    case "PAST": return "انتهت هذه الفعالية.";
    case "EXTERNAL": return "يتم الحجز من موقع المنظّم.";
    case "FULL": return "اكتمل الحجز.";
    case "BOOKED":
      return myStatus === "CANCELLED" || myStatus === "REFUNDED"
        ? "ألغيت حجزك لهذه الفعالية، ولا يمكن الحجز مرة أخرى من المتجر."
        : "لديك حجز مؤكد لهذه الفعالية.";
  }
}

const CANCELLATION_REASONS: Record<string, string> = {
  "Event starts in less than 24 hours": "لا يمكن الإلغاء قبل أقل من 24 ساعة من موعد الفعالية.",
  "Ticket already used": "استُخدمت إحدى التذاكر، لذا لا يمكن الإلغاء.",
  "Booking is not confirmed": "الحجز غير مؤكد بعد.",
};

export function cancellationReasonLabel(reason: string | null): string {
  return (reason && CANCELLATION_REASONS[reason]) || "لا يمكن إلغاء هذا الحجز الآن.";
}
