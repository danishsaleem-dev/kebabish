"use client";

import { Printer } from "lucide-react";

/**
 * Prints the current page as-is via the browser's own dialog — the admin
 * chrome (sidebar, header) is stripped by the `@media print` rules in
 * globals.css, same pattern TableActions already uses for table exports.
 * No PDF generation, no separate print-only route to keep in sync.
 */
export default function PrintButton({ label = "Print ticket" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas print:hidden"
    >
      <Printer size={15} />
      {label}
    </button>
  );
}
