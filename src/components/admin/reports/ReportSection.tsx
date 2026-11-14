"use client";

import { useRef, type ReactNode } from "react";
import { ChartColumn, Download, Printer, Table2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";

/** A section that can be read either way shows one or the other, never both at once. */
export type ReportView = "chart" | "table";

/**
 * One report area: a heading, the figures, and its own Print and Export buttons.
 *
 * **Printing just this area** works by marking the body and the chosen section and letting CSS
 * hide the rest (`body[data-print-only] [data-report-section]:not([data-printing])` in
 * globals.css). A second window or a print-only route would mean a second copy of every chart
 * to keep in step with this one; this prints exactly what the reader is looking at, which is
 * the whole point of a per-area print button.
 *
 * The range is repeated inside every section, visible only on paper — a printed page that
 * doesn't say which days it covers is worse than useless in a folder.
 */
export default function ReportSection({
  title,
  subtitle,
  rangeLabel,
  onExport,
  view,
  onView,
  children,
}: {
  title: string;
  subtitle?: string;
  /** "1 – 7 Oct 2026" — printed under the title, on paper only. */
  rangeLabel: string;
  onExport?: () => void;
  /**
   * Pass both to get the chart/table switch next to Print and Export. The section
   * then shows one of the two at a time rather than stacking them, so the page stays
   * short and whoever is reading picks the shape they want.
   */
  view?: ReportView;
  onView?: (view: ReportView) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function printThis() {
    const el = ref.current;
    if (!el) return;
    document.body.dataset.printOnly = "1";
    el.setAttribute("data-printing", "");
    const cleanup = () => {
      delete document.body.dataset.printOnly;
      el.removeAttribute("data-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // A browser that doesn't fire afterprint would otherwise leave the page with every other
    // section hidden the next time someone prints.
    setTimeout(cleanup, 1000);
  }

  return (
    <div ref={ref} data-report-section>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            <p className="mt-1 hidden text-sm text-muted print:block">
              Kebabish · {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-1 print:hidden">
            {view && onView && (
              <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-hairline p-0.5">
                {([
                  { id: "chart" as const, Icon: ChartColumn, label: "chart" },
                  { id: "table" as const, Icon: Table2, label: "table" },
                ]).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onView(id)}
                    aria-pressed={view === id}
                    title={`Show ${title} as a ${label}`}
                    aria-label={`Show ${title} as a ${label}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      view === id ? "bg-charcoal-600 text-white" : "text-muted hover:bg-canvas hover:text-heading"
                    }`}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={printThis}
              title={`Print "${title}"`}
              aria-label={`Print ${title}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading"
            >
              <Printer size={16} />
            </button>
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                title={`Export "${title}" as CSV`}
                aria-label={`Export ${title}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading"
              >
                <Download size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">{children}</div>
      </Card>
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  /** Rendered in a lighter weight — supporting detail rather than the number being read. */
  muted?: boolean;
}

/** The plain table every breakdown uses. Empty reads as a sentence, not an empty grid. */
export function ReportTable<T>({
  rows,
  columns,
  keyOf,
  empty = "Nothing in this period.",
  limit,
}: {
  rows: T[];
  columns: Column<T>[];
  keyOf: (row: T, index: number) => string;
  empty?: string;
  /** Show only the first N rows on screen; the CSV export always holds them all. */
  limit?: number;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  }
  const shown = limit ? rows.slice(0, limit) : rows;

  // The first column is the row's name. On a phone the figures are wider than the screen and the
  // table scrolls sideways, so that column stays put (sticky) and the reader never loses track of
  // which row they are looking at. It is capped in width so a long dish name wraps rather than
  // taking half the screen; the other columns keep their text on one line.
  const sticky =
    "max-sm:first:sticky max-sm:first:left-0 max-sm:first:z-[1] max-sm:first:min-w-24 max-sm:first:max-w-36 max-sm:first:bg-panel max-sm:first:pr-3 max-sm:first:shadow-[6px_0_6px_-6px_rgba(16,24,40,0.12)]";
  const scrolls = columns.length > 3;

  return (
    <>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`whitespace-nowrap px-3 py-2.5 first:pl-0 last:pr-0 ${sticky} ${
                    col.align === "right" ? "text-right" : ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={keyOf(row, i)} className="border-b border-hairline last:border-0">
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`px-3 py-2.5 first:pl-0 last:pr-0 ${sticky} ${
                      col.align === "right" ? "whitespace-nowrap text-right tabular-nums" : ""
                    } ${col.muted ? "text-muted" : "text-body-text"}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scrolls && (
        <p className="mt-2 text-xs text-faint sm:hidden print:hidden">Swipe sideways to see every column →</p>
      )}
      {limit && rows.length > shown.length && (
        <p className="mt-3 text-xs text-muted print:hidden">
          Showing the top {shown.length} of {rows.length}. Export the CSV for all of them.
        </p>
      )}
    </>
  );
}
