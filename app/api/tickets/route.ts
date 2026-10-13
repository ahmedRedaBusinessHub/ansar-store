import { NextResponse, type NextRequest } from "next/server";
import { qrSvg } from "@/lib/qr";
import { getSessionToken } from "@/lib/session";
import { toTicketBooking, visibleBookings, type TicketBooking, type TicketBookingView } from "@/lib/tickets";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, ticketFailure } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The shopper's match bookings with QR codes. `?booking={id}` returns just that booking (result page). */
export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const only = request.nextUrl.searchParams.get("booking");
  try {
    const { data } = await upstream<unknown[]>("/api/v2/match-bookings?my=1", { token });
    const all = (Array.isArray(data) ? data : [])
      .map(toTicketBooking)
      .filter((booking): booking is TicketBooking => booking !== null);
    const chosen = only ? all.filter((booking) => booking.id === only) : visibleBookings(all);
    const bookings: TicketBookingView[] = await Promise.all(chosen.map(async ({ tickets, ...rest }) => ({
      ...rest,
      tickets: await Promise.all(tickets.map(async (ticket) => ({
        id: ticket.id, number: ticket.number, status: ticket.status, qrSvg: await qrSvg(ticket.qrPayload),
      }))),
    })));
    return NextResponse.json({ bookings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return ticketFailure(error instanceof UpstreamError ? error.status : 503);
  }
}
