import Link from "next/link";
import { Gift, Info } from "lucide-react";

/** How many movements show before "Show all activity". */
const RECENT = 6;

export type HistoryEntry = {
  id: string;
  /** What happened, in the customer's words. */
  label: string;
  /** Already formatted date. */
  date: string;
  /** Signed and formatted, e.g. "+450" or "−200". */
  points: string;
  positive: boolean;
};

/**
 * The points page below the balance hero: the rules in one line, anything
 * the customer should know about points on their way, and the full ledger.
 *
 * The ledger is the record — a balance is always the sum of these rows,
 * never a stored number (see lib/rewards.ts) — so showing all of it is the
 * honest thing to do, folded behind a `<details>` so it isn't a wall.
 */
export default function RewardsCard({
  rate,
  howItWorks,
  howItWorksHref,
  notes,
  historyTitle,
  showAll,
  historyEmpty,
  history,
}: {
  rate: string;
  howItWorks: string;
  howItWorksHref: string;
  /** Welcome points, points pending delivery, points held for an unpaid order. */
  notes: string[];
  historyTitle: string;
  showAll: string;
  historyEmpty: string;
  history: HistoryEntry[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <Gift size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-body-text">{rate}</p>
            <Link
              href={howItWorksHref}
              className="mt-1.5 inline-block text-sm font-semibold text-ember-700 underline underline-offset-2 hover:text-ember-600"
            >
              {howItWorks}
            </Link>
          </div>
        </div>

        {notes.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-hairline pt-4">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-2 text-xs text-muted">
                <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-faint" />
                {note}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="border-b border-hairline px-5 py-4 font-display text-base font-semibold text-heading sm:px-6">
          {historyTitle}
        </h2>

        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">{historyEmpty}</p>
        ) : (
          <>
            <ul className="divide-y divide-hairline">
              {history.slice(0, RECENT).map((row) => (
                <HistoryRow key={row.id} row={row} />
              ))}
            </ul>
            {history.length > RECENT && (
              <details className="group border-t border-hairline">
                <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-ember-700 marker:content-none hover:bg-canvas group-open:hidden sm:px-6">
                  {showAll}
                </summary>
                <ul className="divide-y divide-hairline">
                  {history.slice(RECENT).map((row) => (
                    <HistoryRow key={row.id} row={row} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function HistoryRow({ row }: { row: HistoryEntry }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-5 py-3 sm:px-6">
      <span className="min-w-0">
        <span className="block truncate text-sm text-body-text">{row.label}</span>
        <span className="block text-xs text-faint">{row.date}</span>
      </span>
      <span
        className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
          row.positive ? "text-success" : "text-heading"
        }`}
      >
        {row.points}
      </span>
    </li>
  );
}
