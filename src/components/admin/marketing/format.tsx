/**
 * Shared formatting for the Email marketing screens.
 *
 * Times are always Amsterdam's, never the server's. Vercel runs in UTC, so
 * printing a raw local time would put every send two hours out — the same
 * reason every customer-facing time in this codebase is formatted in
 * `Europe/Amsterdam`.
 */

export function when(value: string | null | undefined): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

/** "3 days ago", for a last-synced line. */
export function howLongAgo(value: string | null | undefined): string {
  if (!value) return "never";
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "never";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-success-soft text-success",
  archive: "bg-success-soft text-success",
  queued: "bg-warn-soft text-warn",
  in_process: "bg-warn-soft text-warn",
  in_review: "bg-warn-soft text-warn",
  draft: "bg-canvas text-muted",
  suspended: "bg-danger-soft text-danger",
  cancelled: "bg-danger-soft text-danger",
  cancelling: "bg-danger-soft text-danger",
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  archive: "Sent",
  queued: "Scheduled",
  in_process: "Sending",
  in_review: "In review",
  draft: "Draft",
  suspended: "Stopped",
  cancelled: "Cancelled",
  cancelling: "Stopping",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        STATUS_STYLE[status] ?? "bg-canvas text-muted"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** The wording for why a chosen address was dropped from a send. */
export const SKIP_REASON: Record<string, string> = {
  suppressed: "unsubscribed",
  "no-consent": "hasn't opted in",
  "bad-email": "not a usable address",
};
