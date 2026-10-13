import { toMatchDetail, toMatchSection, toTicketedMatch, type MatchDetail, type MatchSection, type TicketedMatch } from "./matches";
import { upstream, UpstreamError } from "./upstream";

/** Matches the storefront sells, soonest first. Throws UpstreamError when web-api is down. */
export async function fetchTicketedMatches(): Promise<TicketedMatch[]> {
  const { data } = await upstream<unknown[]>("/api/v2/matches/ticketed");
  return (Array.isArray(data) ? data : [])
    .map(toTicketedMatch)
    .filter((match): match is TicketedMatch => match !== null);
}

/**
 * null for an unknown or unpublished match. Sales info is read first: it is the
 * call that answers 404 for drafts, so a draft's details are never fetched.
 */
export async function fetchMatchDetail(id: string): Promise<MatchDetail | null> {
  try {
    const sales = await upstream<unknown>(`/api/v2/matches/${id}/sales-info`);
    const match = await upstream<unknown>(`/api/v2/matches/${id}`);
    return toMatchDetail(match.data, sales.data);
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export async function fetchMatchSections(id: string): Promise<MatchSection[]> {
  const { data } = await upstream<unknown[]>(`/api/v2/matches/${id}/sections`);
  return (Array.isArray(data) ? data : [])
    .map(toMatchSection)
    .filter((section): section is MatchSection => section !== null);
}
