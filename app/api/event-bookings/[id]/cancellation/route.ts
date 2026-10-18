import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fail, upstreamFailure, uuid } from "@/app/api/checkout/shared";
import { getSessionToken, isJsonRequest } from "@/lib/session";
import { upstream, upstreamBody } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eligibilitySchema = z.object({
  eligible: z.boolean(),
  mode: z.enum(["self_service", "approval_required", "ineligible"]),
  refund_amount: z.number().nullable(),
  reason: z.string().nullable(),
  pending_request_id: z.string().nullable().optional(),
});
type Eligibility = z.infer<typeof eligibilitySchema>;

async function eligibility(token: string, id: string): Promise<Eligibility> {
  const query = new URLSearchParams({ purchase_type: "EVENT_BOOKING", purchase_id: id });
  return eligibilitySchema.parse((await upstream<unknown>(`/api/v2/cancellation-requests/eligibility?${query}`, { token })).data);
}

async function guard(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = getSessionToken(request);
  const { id } = await context.params;
  if (!token) return { error: fail(401, "unauthenticated") } as const;
  if (!uuid.safeParse(id).success) return { error: fail(400, "invalid_input") } as const;
  return { token, id } as const;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = await guard(request, context);
  if ("error" in g) return g.error;
  try {
    const e = await eligibility(g.token, g.id);
    return NextResponse.json({
      mode: e.mode, eligible: e.eligible, refundAmountHalalah: e.refund_amount,
      reason: e.reason, pendingRequestId: e.pending_request_id ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(503, "upstream_unavailable");
    return upstreamFailure(error);
  }
}

/** Cancels a free booking directly, or files an (auto-approved) refund request for a paid one. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isJsonRequest(request)) return fail(415, "invalid_input");
  const g = await guard(request, context);
  if ("error" in g) return g.error;
  try {
    const e = await eligibility(g.token, g.id);
    if (e.mode === "self_service") {
      await upstreamBody<unknown>(`/api/v2/events/subscribed/${g.id}`, { method: "DELETE", token: g.token });
      return NextResponse.json({ result: "CANCELLED" });
    }
    if (e.mode !== "approval_required" || !e.eligible) return fail(409, "not_eligible", { reason: e.reason });
    const { data } = await upstream<{ status?: string }>("/api/v2/cancellation-requests", {
      method: "POST", token: g.token,
      body: { purchase_type: "EVENT_BOOKING", purchase_id: g.id, reason: "إلغاء من المتجر الإلكتروني" },
    });
    return NextResponse.json({ result: data?.status === "pending" ? "PENDING" : "REFUNDED" });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(503, "upstream_unavailable");
    return upstreamFailure(error);
  }
}

/** Withdraws a pending cancellation request: `?request={id}`. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = await guard(request, context);
  if ("error" in g) return g.error;
  const requestId = request.nextUrl.searchParams.get("request") ?? "";
  if (!uuid.safeParse(requestId).success) return fail(400, "invalid_input");
  try {
    await upstreamBody<unknown>(`/api/v2/cancellation-requests/${requestId}`, { method: "DELETE", token: g.token });
    return NextResponse.json({ result: "WITHDRAWN" });
  } catch (error) {
    return upstreamFailure(error);
  }
}
