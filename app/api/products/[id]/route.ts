import { fetchProducts, findProduct } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const product = findProduct(await fetchProducts(), id);
    if (!product) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(product);
  } catch {
    return Response.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
