"use client";

import { Download, Printer } from "lucide-react";

/**
 * Print / export buttons that sit at the top-right of a table.
 *
 * Both act on what's currently on screen: print uses the browser dialog with
 * the admin chrome hidden (see the print rules in globals.css), export writes
 * a CSV of the filtered rows.
 */
export default function TableActions({
  onExport,
  exportLabel = "Export CSV",
}: {
  onExport: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        aria-label="Print this table"
        title="Print"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading"
      >
        <Printer size={16} />
      </button>
      <button
        type="button"
        onClick={onExport}
        aria-label={exportLabel}
        title={exportLabel}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading"
      >
        <Download size={16} />
      </button>
    </div>
  );
}
