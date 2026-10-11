import "server-only";

/**
 * A blunt per-instance limit on how often one visitor can submit feedback.
 *
 * Feedback without an order link is open to anyone, so something has to stand
 * between the form and a script that posts it in a loop. This is deliberately
 * the same kind of tool as the password-reset throttle: an in-memory map, so it
 * is per server instance and resets on a cold start — not a security boundary,
 * just enough to make abuse tedious. The real protections are the unique index
 * (one feedback per order), the honeypot, and that a submission does nothing
 * but add a row for staff to read.
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 6;

const hits = new Map<string, number[]>();

/** True when this visitor may submit now; records the attempt if so. */
export function allowFeedbackSubmission(visitorKey: string): boolean {
  const now = Date.now();
  const recent = (hits.get(visitorKey) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(visitorKey, recent);
    return false;
  }
  recent.push(now);
  hits.set(visitorKey, recent);

  // Don't let the map grow for ever on a long-lived instance.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return true;
}
