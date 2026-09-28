import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { SiteContent } from "./types";

const text = z.string().trim().min(1);
const money = z.number().min(0).max(1_000_000);
const asset = z.string().regex(/^\/images\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg|svg)$/);
const siteSchema = z.object({
  name: text,
  season: text,
  hero: z.object({ eyebrow: text, title: text, description: text, image: asset }),
  shipping: z.object({ fee: money, freeAbove: money }),
  policies: z.array(z.object({ id: text, title: text, body: text })).min(1),
});

export async function readSite(): Promise<SiteContent> {
  const source = await readFile(path.join(process.cwd(), "data", "store.json"), "utf8");
  return siteSchema.parse(JSON.parse(source));
}
