import { CatalogQueryError, fetchProducts, queryProducts } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let products;
  try {
    products = await fetchProducts();
  } catch {
    return Response.json({ error: "upstream_unavailable" }, { status: 503 });
  }
  try {
    return Response.json(queryProducts(products, new URL(request.url).searchParams));
  } catch (error) {
    if (error instanceof CatalogQueryError) return Response.json({ error: "invalid_input" }, { status: 400 });
    return Response.json({ error: "upstream_unavailable" }, { status: 503 });
  }
}
