import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/product-seo";

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}
