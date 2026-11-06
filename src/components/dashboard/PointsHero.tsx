import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * The overview page's focal point: what the customer's points are worth
 * right now and how close the next discount is. Dark, because the rest of
 * the dashboard is white cards on grey and this is the one thing that
 * should pull the eye — the same charcoal/ember pairing the public site
 * uses for its dark bands.
 *
 * Every number is passed in already formatted, so this stays a dumb,
 * server-rendered card with no locale logic of its own.
 */
export default function PointsHero({
  label,
  points,
  worth,
  progress,
  progressLabel,
  linkLabel,
  href,
}: {
  label: string;
  /** Formatted balance, e.g. "1.250". */
  points: string;
  /** What it is worth in euros, or null when the balance is nothing yet. */
  worth: string | null;
  /** 0–1, how far to the next reward step. */
  progress: number;
  progressLabel: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-800 via-charcoal-900 to-charcoal-950 p-5 sm:p-6">
      {/* A soft ember bloom, so the card has depth without a photo behind it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-ember-600/25 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-ember-700/20 blur-3xl"
      />

      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cream-400">
          <Sparkles size={14} aria-hidden="true" className="text-ember-400" />
          {label}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-[2.75rem] font-semibold leading-none tabular-nums text-cream-50 sm:text-5xl">
            {points}
          </p>
          {worth && <p className="text-sm font-medium text-cream-300">{worth}</p>}
        </div>

        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-cream-50/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={progressLabel}
        >
          <div
            className="h-full rounded-full bg-ember-400 transition-[width] duration-500"
            style={{ width: `${Math.max(Math.round(progress * 100), 2)}%` }}
          />
        </div>
        <p className="mt-2.5 text-sm text-cream-200">{progressLabel}</p>

        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-cream-50/10 px-3.5 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-cream-50/20"
        >
          {linkLabel}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
