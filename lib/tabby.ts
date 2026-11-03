import type { InstalmentEntity } from "./tamara";

/** Only Tabby-hosted https checkout pages may receive the shopper (defence against a tampered upstream URL). */
export function isTabbyCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === "https:" && url.username === "" && url.password === ""
    && (url.hostname === "tabby.ai" || url.hostname === "tabby.sa"
      || url.hostname.endsWith(".tabby.ai") || url.hostname.endsWith(".tabby.sa"));
}

export type TabbyRejectionReason = "not_available" | "order_amount_too_high" | "order_amount_too_low";

export function tabbyRejectionMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "order_amount_too_high":
      return "قيمة الطلب تفوق الحد الأقصى المسموح به حاليًا مع تابي. يُرجى تخفيض قيمة السلة أو استخدام وسيلة دفع أخرى.";
    case "order_amount_too_low":
      return "قيمة الطلب أقل من الحد الأدنى المطلوب لاستخدام خدمة تابي. يُرجى زيادة قيمة الطلب أو استخدام وسيلة دفع أخرى.";
    case "not_available":
    default:
      return "نأسف، تابي غير قادر على الموافقة على هذه العملية. الرجاء استخدام طريقة دفع أخرى.";
  }
}

export function entityIdKey(entity: InstalmentEntity): "orderId" | "passId" | "subscriptionId" | "bookingId" {
  switch (entity.type) {
    case "ORDER": return "orderId";
    case "SEASON_PASS": return "passId";
    case "EVENT": return "subscriptionId";
    case "MATCH_BOOKING": return "bookingId";
  }
}

export function tabbyInstalmentLabel(halalah: number): string {
  return `4 دفعات بقيمة ${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(halalah / 100)} ر.س شهريًا أو حتى 12 شهرًا. اعرف المزيد`;
}
