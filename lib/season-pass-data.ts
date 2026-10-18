import { toSeasonInfo, toSeasonTier, type SeasonInfo, type SeasonPassOffer, type SeasonTier } from "./season-pass";
import { upstream, UpstreamError } from "./upstream";

/** The current season, or null when web-api has none (404). Throws UpstreamError for anything else. */
export async function fetchCurrentSeason(): Promise<SeasonInfo | null> {
  try {
    const { data } = await upstream<unknown>("/api/v2/seasons/current");
    return toSeasonInfo(data);
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return null;
    throw error;
  }
}

/** Current season with its active tiers, in web-api order (price ascending). null = no current season. */
export async function fetchSeasonPassOffer(): Promise<SeasonPassOffer | null> {
  const season = await fetchCurrentSeason();
  if (!season) return null;
  const { data } = await upstream<unknown[]>(`/api/v2/seasons/${season.id}/tiers`);
  const tiers = (Array.isArray(data) ? data : [])
    .map(toSeasonTier)
    .filter((tier): tier is SeasonTier => tier !== null);
  return { season, tiers };
}
