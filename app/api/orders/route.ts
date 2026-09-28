import { NextResponse, type NextRequest } from "next/server";
import { toOrderSummary } from "@/lib/adapter";
import { upstream } from "@/lib/upstream";
import type { OrderSummary } from "@/lib/types";
import { fail, tokenOrNull, upstreamFailure } from "../checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = tokenOrNull(request);
  if (!token) return fail(401, "unauthenticated");
  try {
    const { data } = await upstream<unknown[]>("/api/v2/orders", { token });
    const orders = (Array.isArray(data) ? data : []).map(toOrderSummary).filter((order): order is OrderSummary => order !== null);
    return NextResponse.json({ orders });
  } catch (error) {
    return upstreamFailure(error);
  }
}
