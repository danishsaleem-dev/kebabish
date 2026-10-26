import Link from "next/link";
import { Lock } from "lucide-react";
import type { OpenDay } from "@/lib/business-day";

const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const instantLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

/** One line on the dashboard: which business day is open, and the way to close it. */
export default function BusinessDayBanner({ open }: { open: OpenDay }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel px-5 py-3.5 sm:mb-6">
      <p className="text-sm text-body-text">
        <span className="font-semibold text-heading">Business day: {dayLabel(open.businessDate)}</span>
        <span className="text-muted">
          {" "}
          · {open.firstEver ? "no day closed yet" : `open since ${instantLabel(open.openedAt)}`}
        </span>
      </p>
      <Link
        href="/admin/close-day"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
      >
        <Lock size={14} />
        Close the day
      </Link>
    </div>
  );
}
