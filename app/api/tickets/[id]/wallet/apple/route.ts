import type { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { upstreamRaw } from "@/lib/upstream";
import { fail, redirectTo, streamFile, TICKET_ID, ticketFailure } from "../../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = getSessionToken(request);
  if (!token) return fail(401, "unauthenticated");
  const { id } = await context.params;
  if (!TICKET_ID.test(id)) return fail(404, "not_found");
  try {
    const response = await upstreamRaw(`/api/v2/tickets/${id}/wallet/apple`, { token });
    if (!response.ok) return ticketFailure(response.status);
    // web-api answers JSON { fallback: "pdf" } when Apple Wallet signing is not configured.
    if ((response.headers.get("content-type") ?? "").includes("application/json")) return redirectTo(`/api/tickets/${id}/pdf`);
    return streamFile(response, "application/vnd.apple.pkpass", "alansar-ticket.pkpass");
  } catch {
    return fail(503, "upstream_unavailable");
  }
}
