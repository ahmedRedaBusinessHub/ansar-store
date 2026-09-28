import { NextResponse } from "next/server";
import { z } from "zod";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, money } from "../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  zones: z.array(z.object({ id: z.string(), name_ar: z.string(), shipping_fee: money, free_shipping_threshold: money.nullable() })),
});

export async function GET() {
  try {
    const { data } = await upstream<unknown>("/api/v2/store/shipping-zones");
    const parsed = schema.parse(data);
    return NextResponse.json({
      enabled: parsed.enabled,
      zones: parsed.zones.map((zone) => ({ id: zone.id, name: zone.name_ar, fee: zone.shipping_fee, freeThreshold: zone.free_shipping_threshold })),
    });
  } catch (error) {
    // A web-api build without zone shipping has no such route: shipping is simply off.
    if (error instanceof UpstreamError && error.status === 404) return NextResponse.json({ enabled: false, zones: [] });
    return fail(503, "upstream_unavailable");
  }
}
