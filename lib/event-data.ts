import { toEventBookingInfo, toEventSummary, type EventBookingInfo, type EventSummary } from "./events";
import { upstream, UpstreamError } from "./upstream";

/** Upcoming events, soonest first. Throws UpstreamError when web-api is down. */
export async function fetchBookableEvents(cache: { revalidate?: number } = {}): Promise<EventSummary[]> {
  const { data } = await upstream<unknown[]>("/api/v2/events/bookable?page=1&perPage=50", cache);
  return (Array.isArray(data) ? data : []).map(toEventSummary).filter((e): e is EventSummary => e !== null);
}

/** null for an unknown event. Pass `revalidate` only from ISR pages (no token there). */
export async function fetchEventInfo(
  id: string,
  token: string | null,
  cache: { revalidate?: number } = {},
): Promise<EventBookingInfo | null> {
  try {
    const { data } = await upstream<unknown>(`/api/v2/events/${id}/booking-info`, { ...cache, token });
    return toEventBookingInfo(data);
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
