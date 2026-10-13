import type { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { upstream, UpstreamError } from "@/lib/upstream";
import { fail, redirectTo, TICKET_ID, ticketFailure } from "../../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_SAVE_PREFIX = "https://pay.google.com/";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!TICKET_ID.test(id)) return fail(404, "not_found");
  try {
    const { data } = await upstream<{ save_url?: unknown }>(`/api/v2/tickets/${id}/wallet/google`, { token });
    const saveUrl = typeof data?.save_url === "string" && data.save_url.startsWith(GOOGLE_SAVE_PREFIX) ? data.save_url : null;
    return redirectTo(saveUrl ?? `/api/tickets/${id}/pdf`);
  } catch (error) {
    return ticketFailure(error instanceof UpstreamError ? error.status : 503);
  }
}
