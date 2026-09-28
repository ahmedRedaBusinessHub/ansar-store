import { readStore } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await readStore());
  } catch {
    return Response.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
