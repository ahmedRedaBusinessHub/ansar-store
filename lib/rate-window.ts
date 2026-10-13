export type WindowLimiter = { hit(key: string): boolean };

const MAX_KEYS = 10_000;

/** In-memory fixed-window limiter for one process. `hit` counts a request and returns true when it is over the limit. */
export function createWindowLimiter(limit: number, windowMs: number, now: () => number = Date.now): WindowLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key: string): boolean {
      const time = now();
      let entry = windows.get(key);
      if (!entry || time >= entry.resetAt) {
        if (windows.size >= MAX_KEYS) {
          for (const [stale, value] of windows) if (time >= value.resetAt) windows.delete(stale);
        }
        entry = { count: 0, resetAt: time + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return entry.count > limit;
    },
  };
}
