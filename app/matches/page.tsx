import type { Metadata } from "next";
import MatchesPage from "@/components/matches-page";
import { readStore } from "@/lib/catalog";
import { fetchTicketedMatches } from "@/lib/match-data";
import type { TicketedMatch } from "@/lib/matches";
import { STORE_NAME } from "@/lib/product-seo";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `تذاكر المباريات | ${STORE_NAME}`,
  description: "احجز تذاكر مباريات الأنصار على أرضه وادفع إلكترونيًا، وتصلك التذاكر فورًا.",
  alternates: { canonical: "/matches" },
};

export default async function Page() {
  const store = await readStore(); // throws when web-api is down and nothing is cached → error.tsx
  let matches: TicketedMatch[] = [];
  try {
    matches = await fetchTicketedMatches();
  } catch {
    matches = [];
  }
  return <MatchesPage store={store} matches={matches} />;
}
