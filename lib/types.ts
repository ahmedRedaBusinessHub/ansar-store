export type ProductOption = { id: string; label: string; extra: number };            // extra = additional_price in SAR
export type ProductOptionGroup = { id: string; name: string; required: boolean; options: ProductOption[] };
export type Product = {
  id: string; name: string; subtitle: string; category: string; price: number; originalPrice?: number;
  image: string; images: string[]; colors: { name: string; value: string }[];
  optionGroups: ProductOptionGroup[]; badge?: string; description: string; details: string[];
  productType: "REGULAR" | "INVITATION_TICKET" | "INVITATION_TICKET_BOOK";
};
export type SiteContent = {
  name: string; season: string;
  hero: { eyebrow: string; title: string; description: string; image: string };
  shipping: { fee: number; freeAbove: number };
  policies: { id: string; title: string; body: string }[];
};
export type StoreData = SiteContent & { categories: { id: string; label: string }[]; products: Product[] };
export type CartItem = { id: string; optionIds: string[]; quantity: number };        // optionIds sorted ascending
export type SessionUser = { id: string; name: string; phone: string; points: number; isMember: boolean };
export type ShippingZone = { id: string; name: string; fee: number; freeThreshold: number | null };
export type CheckoutInput = { items: CartItem[]; deliveryAddress: string; couponCode?: string; pointsToSpend?: number; shippingZoneId?: string; expectedShippingFee?: number };
export type PreviewResult = { originalTotal: number; totalDiscount: number; finalTotal: number; couponValid: boolean; couponMessage: string | null; pointsSpent: number; pointsError: string | null;
  shippingEnabled: boolean; shippingRequired: boolean; shippingFee: number; freeShippingApplied: boolean; amountToFreeShipping: number | null; grandTotal: number };
export type CheckoutResult = { orderId: string; total: number; requiresPayment: boolean;
  payment: null | { paymentId: string; givenId: string; amountHalalah: number; currency: string; description: string; metadata: { payment_id: string; entity_type: string; entity_id: string } } };
export type PaymentState = { paymentId: string; status: "INITIATED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "REFUNDING"; orderId: string };
export type OrderSummary = { id: string; createdAt: string; total: number; paymentStatus: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
  fulfillmentStatus: "PENDING" | "PREPARING" | "SHIPPED" | "FINISHED" | "CANCELLED"; trackingNumber: string | null; deliveryAddress: string;
  items: { name: string; image: string | null; quantity: number; unitPrice: number; total: number; options: string[] }[] };
