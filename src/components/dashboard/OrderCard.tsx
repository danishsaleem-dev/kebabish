import { ChevronDown, FileText, MapPin, RotateCcw, Star } from "lucide-react";

/**
 * One past order. The dishes are folded away behind a `<details>` — a
 * customer scanning their history wants the date, the total and a way to
 * reorder, not twelve lines of extras — and it is native markup, so it
 * works with no JavaScript and the dish names stay in the HTML.
 */

export type OrderCardLabels = {
  showItems: string;
  /** "3 dishes", already pluralised. */
  itemCount: string;
  reorder: string;
  invoice: string;
  feedback: string;
  feedbackSent: string;
  address: string;
  total: string;
};

export type OrderCardLink = { label: string; href: string };

export default function OrderCard({
  reference,
  date,
  status,
  total,
  lines,
  pointsNote,
  creditNotes,
  reorderHref,
  invoiceHref,
  feedbackHref,
  feedbackSent,
  when,
  address,
  labels,
}: {
  reference: string;
  /** Already formatted in the customer's language. */
  date: string;
  /** The small pill: text plus the tone to draw it in. */
  status: { label: string; tone: "success" | "danger" | "warn" | "neutral" };
  total: string;
  lines: { quantity: number; name: string; options: string; total: string }[];
  /** "200 points used · +450 points", or null when there is nothing to say. */
  pointsNote: string | null;
  creditNotes: OrderCardLink[];
  reorderHref: string | null;
  invoiceHref: string | null;
  feedbackHref: string | null;
  feedbackSent: boolean;
  when: string | null;
  address: string;
  labels: OrderCardLabels;
}) {
  const tones = {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
    neutral: "bg-canvas text-muted",
  } as const;

  return (
    <article className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-heading">{reference}</p>
          <p className="mt-0.5 text-xs text-muted">{date}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[status.tone]}`}
          >
            {status.label}
          </span>
          <p className="font-display text-base font-semibold tabular-nums text-heading">
            {total}
          </p>
        </div>
      </div>

      {pointsNote && (
        <p className="border-t border-hairline bg-ember-600/5 px-4 py-2.5 text-xs font-semibold text-ember-700 sm:px-5">
          {pointsNote}
        </p>
      )}

      <details className="group border-t border-hairline">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-body-text marker:content-none hover:bg-canvas sm:px-5">
          <span>
            {labels.showItems}
            <span className="ml-2 font-normal text-muted">{labels.itemCount}</span>
          </span>
          <ChevronDown
            size={17}
            aria-hidden="true"
            className="shrink-0 text-faint transition-transform group-open:rotate-180"
          />
        </summary>

        <ul className="divide-y divide-hairline border-t border-hairline">
          {lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-3 px-4 py-3 text-sm sm:px-5">
              <span className="min-w-0 text-body-text">
                <span className="font-medium text-heading">{line.quantity}×</span> {line.name}
                {line.options && (
                  <span className="mt-0.5 block text-xs text-faint">{line.options}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-heading">{line.total}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-hairline px-4 py-3 text-xs text-muted sm:px-5">
          {when && <p>{when}</p>}
          <p className="flex items-start gap-2">
            <MapPin size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-faint" />
            <span>
              <span className="sr-only">{labels.address}: </span>
              {address}
            </span>
          </p>
        </div>
      </details>

      {creditNotes.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3 sm:px-5">
          {creditNotes.map((note) => (
            <a
              key={note.href}
              href={note.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-heading transition-colors hover:bg-canvas"
            >
              <FileText size={13} aria-hidden="true" />
              {note.label}
            </a>
          ))}
        </div>
      )}

      {(reorderHref || invoiceHref || feedbackHref || feedbackSent) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-canvas/60 px-4 py-3 sm:px-5">
          {reorderHref && (
            <a
              href={reorderHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <RotateCcw size={13} aria-hidden="true" />
              {labels.reorder}
            </a>
          )}
          {feedbackHref && (
            <a
              href={feedbackHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ember-600/40 bg-panel px-3 py-2 text-xs font-semibold text-ember-700 transition-colors hover:bg-ember-600/10"
            >
              <Star size={13} aria-hidden="true" />
              {labels.feedback}
            </a>
          )}
          {feedbackSent && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              {labels.feedbackSent}
            </span>
          )}
          {invoiceHref && (
            <a
              href={invoiceHref}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 py-2 text-xs font-semibold text-heading transition-colors hover:bg-canvas"
            >
              <FileText size={13} aria-hidden="true" />
              {labels.invoice}
            </a>
          )}
        </div>
      )}
    </article>
  );
}
