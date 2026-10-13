import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/components/product-page";
import { fetchProducts, findProduct, readStore } from "@/lib/catalog";
import {
  absoluteImageUrl, IOS_APP_ID, isProductId, jsonLdScript, productDescription,
  productJsonLd, productPath, productUrl, STORE_NAME,
} from "@/lib/product-seo";

// ISR: rendered on first request, then refreshed at most once a minute (matches the catalogue cache).
export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = isProductId(id) ? findProduct(await fetchProducts().catch(() => []), id) : undefined;
  if (!product) return { title: `المنتج غير متاح | ${STORE_NAME}`, robots: { index: false, follow: false } };
  const description = productDescription(product);
  const url = productUrl(product.id);
  const image = absoluteImageUrl(product.image);
  return {
    title: `${product.name} | ${STORE_NAME}`,
    description,
    alternates: { canonical: productPath(product.id) },
    openGraph: { type: "website", url, siteName: STORE_NAME, locale: "ar_SA", title: product.name, description, images: [{ url: image, alt: product.name }] },
    twitter: { card: "summary_large_image", title: product.name, description, images: [image] },
    // Safari Smart App Banner: opens this product in the app, or the App Store.
    itunes: { appId: IOS_APP_ID, appArgument: url },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!isProductId(id)) notFound();
  const store = await readStore(); // throws when web-api is down and nothing is cached → error.tsx
  const product = findProduct(store.products, id);
  if (!product) notFound();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(product)) }} />
    <ProductPage store={store} product={product} />
  </>;
}
