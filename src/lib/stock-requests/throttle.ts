import "server-only";

/**
 * A blunt per-instance limit on how often one visitor can send a "please get this
 * dish in" request — the same kind of tool as the feedback throttle: an in-memory
 * map, per server instance, resetting on a cold start. Not a security boundary, just
 * enough to make a script posting the form in a loop tedious. The form also has a
 * honeypot, and a request does nothing but add a row for staff to read.
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

/** True when this visitor may send a request now; records the attempt if so. */
export function allowStockRequest(visitorKey: string): boolean {
  const now = Date.now();
  const recent = (hits.get(visitorKey) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(visitorKey, recent);
    return false;
  }
  recent.push(now);
  hits.set(visitorKey, recent);

  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return true;
}
