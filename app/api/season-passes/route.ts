import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { qrSvg } from "@/lib/qr";
import {
  isUuid, MAX_FREE_PASSES, sortPasses, toMySeasonPass, toPassCreated, type MySeasonPass, type MySeasonPassView,
} from "@/lib/season-pass";
import { fetchSeasonPassOffer } from "@/lib/season-pass-data";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream } from "@/lib/upstream";
import { fail, listFailure, passFailure, passIpLimiter, readBody } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = z.string().refine(isUuid);
const schema = z.object({
  tierId: id,
  quantity: z.number().int().min(1).max(MAX_FREE_PASSES),
  seatIds: z.array(id).min(1).max(MAX_FREE_PASSES).refine((ids) => new Set(ids).size === ids.length).optional(),
});

/** Buy season passes. The season, the tier's mode and its price come from web-api, never from the browser. Never retried. */
export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) return fail(400, "invalid_input");
  const { tierId, quantity, seatIds } = parsed.data;

  const clientIp = clientIpFrom(request.headers);
  if (clientIp && passIpLimiter.hit(clientIp)) return fail(429, "rate_limited");

  try {
    const offer = await fetchSeasonPassOffer();
    const tier = offer?.tiers.find((candidate) => candidate.id === tierId) ?? null;
    if (!offer || !tier) return fail(404, "not_found");
    const max = tier.price === 0 ? MAX_FREE_PASSES : 1;

    let body: Record<string, unknown>;
    if (tier.mode === "SEAT") {
      // Seat tiers: one pass per seat; web-api ignores `quantity` there.
      if (!seatIds) return fail(400, "invalid_input", { code: "SEAT_SELECTION_REQUIRED" });
      if (seatIds.length > max) return fail(400, "invalid_input", { code: "PAID_QTY_LIMIT" });
      body = { season_id: offer.season.id, tier_id: tier.id, quantity: seatIds.length, venue_seat_ids: seatIds };
    } else {
      if (quantity > max) return fail(400, "invalid_input", { code: "PAID_QTY_LIMIT" });
      body = { season_id: offer.season.id, tier_id: tier.id, quantity };
    }

    const { data } = await upstream<unknown>("/api/v2/season-passes", { method: "POST", token, body, clientIp });
    const created = toPassCreated(data);
    if (!created) return fail(503, "upstream_unavailable");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return passFailure(error);
  }
}

/** The shopper's ACTIVE passes and PENDING ones from the last 15 minutes, QR as SVG. `?pass={id}` returns just that pass. */
export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const only = request.nextUrl.searchParams.get("pass");
  if (only !== null && !isUuid(only)) return fail(400, "invalid_input");
  try {
    const { data } = await upstream<unknown[]>("/api/v2/season-passes?my=1", { token });
    const all = (Array.isArray(data) ? data : [])
      .map(toMySeasonPass)
      .filter((pass): pass is MySeasonPass => pass !== null);
    const chosen = sortPasses(only ? all.filter((pass) => pass.id === only) : all);
    const passes: MySeasonPassView[] = await Promise.all(chosen.map(async ({ qrPayload, ...rest }) => ({
      ...rest,
      qrSvg: qrPayload ? await qrSvg(qrPayload) : null,
    })));
    return NextResponse.json({ passes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return listFailure(error);
  }
}
