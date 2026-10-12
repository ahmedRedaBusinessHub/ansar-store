import { z } from "zod";
import type { OrderSummary, Product } from "./types";
import { absoluteAssetUrl } from "./upstream";

export const PLACEHOLDER_IMAGE = "/images/placeholder.svg";

const money = z.union([z.string().trim().min(1), z.number()])
  .transform(Number)
  .pipe(z.number().finite().min(0))
  .transform((value) => Math.round(value * 100) / 100);

const rowSchema = z.object({
  id: z.string().uuid(),
  name_ar: z.string(),
  name_en: z.string().nullish(),
  description_ar: z.string().nullish(),
  image_url: z.string().nullish(),
  price: money,
  original_price: money.nullish(),
  product_type: z.enum(["REGULAR", "INVITATION_TICKET", "INVITATION_TICKET_BOOK"]),
  // Review aggregates (web-api store feed). A bad value only hides the rating, never the product.
  avg_rating: z.number().min(0).max(5).nullish().catch(null),
  reviews_count: z.number().int().min(0).nullish().catch(null),
  images: z.array(z.object({ image_url: z.string(), is_main: z.boolean().optional(), order: z.number().optional() })).default([]),
  attribute_groups: z.array(z.object({
    id: z.string(), name_ar: z.string(), is_required: z.boolean(), display_order: z.number().optional(),
    options: z.array(z.object({
      id: z.string(), value_ar: z.string(), additional_price: money,
      is_available: z.boolean().optional(), display_order: z.number().optional(),
    })).default([]),
  })).default([]),
});

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => ENTITIES[match] ?? match)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const byOrder = (a: { display_order?: number }, b: { display_order?: number }) => (a.display_order ?? 0) - (b.display_order ?? 0);

export function toProduct(row: unknown): Product | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const item = parsed.data;
  const gallery = [...item.images]
    .sort((a, b) => Number(b.is_main ?? false) - Number(a.is_main ?? false) || (a.order ?? 0) - (b.order ?? 0))
    .map((image) => absoluteAssetUrl(image.image_url))
    .filter((url): url is string => url !== null);
  const legacy = absoluteAssetUrl(item.image_url);
  const images = [...new Set(gallery.length > 0 ? gallery : legacy ? [legacy] : [PLACEHOLDER_IMAGE])];
  const optionGroups = [...item.attribute_groups].sort(byOrder).map((group) => ({
    id: group.id,
    name: group.name_ar.trim() || "خيار",
    required: group.is_required,
    options: group.options.filter((option) => option.is_available !== false).sort(byOrder)
      .map((option) => ({ id: option.id, label: option.value_ar.trim() || "—", extra: option.additional_price })),
  })).filter((group) => group.options.length > 0);
  return {
    id: item.id,
    name: item.name_ar.trim() || (item.name_en ?? "").trim() || "منتج",
    subtitle: "",
    category: "all",
    price: item.price,
    // Only a real offer survives: absent, equal or inverted pairs drop the key.
    ...(item.original_price != null && item.original_price > item.price
      ? { originalPrice: item.original_price }
      : {}),
    image: images[0],
    images,
    colors: [],
    optionGroups,
    description: stripHtml(item.description_ar ?? ""),
    details: [],
    productType: item.product_type,
    ...(item.avg_rating != null && item.reviews_count ? { rating: { average: item.avg_rating, count: item.reviews_count } } : {}),
  };
}

const orderSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  total_price: money,
  payment_status: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED"]),
  fulfillment_status: z.enum(["PENDING", "PREPARING", "SHIPPED", "FINISHED", "CANCELLED"]),
  tracking_number: z.string().nullish(),
  delivery_address: z.string(),
  order_items: z.array(z.object({
    quantity: z.number().int(),
    unit_price: money,
    total_price: money,
    item_name_ar: z.string().nullish(),
    item_image_url: z.string().nullish(),
    attributes: z.array(z.object({ group_name_ar: z.string(), value_ar: z.string() })).default([]),
  })).default([]),
});

export function toOrderSummary(row: unknown): OrderSummary | null {
  const parsed = orderSchema.safeParse(row);
  if (!parsed.success) return null;
  const order = parsed.data;
  return {
    id: order.id,
    createdAt: order.created_at,
    total: order.total_price,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    trackingNumber: order.tracking_number ?? null,
    deliveryAddress: order.delivery_address,
    items: order.order_items.map((line) => ({
      name: line.item_name_ar?.trim() || "منتج",
      image: absoluteAssetUrl(line.item_image_url),
      quantity: line.quantity,
      unitPrice: line.unit_price,
      total: line.total_price,
      options: line.attributes.map((attribute) => `${attribute.group_name_ar}: ${attribute.value_ar}`),
    })),
  };
}
