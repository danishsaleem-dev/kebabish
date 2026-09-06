"use client";

import { Download } from "lucide-react";

/**
 * Prints the receipt card on the page as-is — no PDF generation, no
 * separate print-only route. The surrounding chrome (header, footer,
 * WhatsApp button, this button itself) is stripped by the `print:hidden`
 * classes on those components and the `@media print` rules in globals.css.
 */
export default function ReceiptPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full border border-charcoal-600/20 px-6 py-3 font-display text-sm font-semibold text-charcoal-600 transition-colors hover:border-ember-600 hover:text-ember-600"
    >
      <Download size={16} />
      {label}
    </button>
  );
}
