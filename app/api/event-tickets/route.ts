import { NextResponse, type NextRequest } from "next/server";
import { fail, upstreamFailure } from "@/app/api/checkout/shared";
import { toMyEventBooking, type MyEventBooking, type MyEventBookingView } from "@/lib/events";
import { qrSvg } from "@/lib/qr";
import { getSessionToken } from "@/lib/session";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The shopper's event bookings with QR codes. `?booking={id}` returns just that booking (result page). */
export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const only = request.nextUrl.searchParams.get("booking");
  try {
    const { data } = await upstream<unknown[]>("/api/v2/events/my-bookings?page=1&perPage=50", { token });
    const all = (Array.isArray(data) ? data : []).map(toMyEventBooking).filter((b): b is MyEventBooking => b !== null);
    const chosen = only ? all.filter((b) => b.id === only) : all;
    const bookings: MyEventBookingView[] = await Promise.all(chosen.map(async ({ tickets, ...rest }) => ({
      ...rest,
      tickets: await Promise.all(tickets.map(async ({ qrPayload, ...ticket }) => ({ ...ticket, qrSvg: await qrSvg(qrPayload) }))),
    })));
    return NextResponse.json({ bookings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return upstreamFailure(error);
  }
}
