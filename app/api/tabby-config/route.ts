import { NextResponse } from "next/server";
import { upstreamBody } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TabbyConfigResponse = {
  enabled: boolean;
  publicKey: string | null;
  merchantCode: string | null;
};

const disabledConfig: TabbyConfigResponse = {
  enabled: false,
  publicKey: null,
  merchantCode: null,
};

export async function GET() {
  try {
    const raw = await upstreamBody<Record<string, unknown>>("/api/v2/app-config", { revalidate: 60 });
    const data = (raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object")
      ? (raw.data as Record<string, unknown>)
      : raw;

    const tabbyEnabled = data?.tabby_enabled === true;
    const rawPublicKey = typeof data?.tabby_public_key === "string" ? data.tabby_public_key.trim() : "";
    const rawMerchantCode = typeof data?.tabby_merchant_code === "string" ? data.tabby_merchant_code.trim() : "";

    if (tabbyEnabled && rawPublicKey.length > 0 && rawMerchantCode.length > 0) {
      return NextResponse.json({
        enabled: true,
        publicKey: rawPublicKey,
        merchantCode: rawMerchantCode,
      });
    }

    return NextResponse.json(disabledConfig);
  } catch {
    return NextResponse.json(disabledConfig);
  }
}
