"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Share this dish: the phone's own share sheet where there is one (WhatsApp is how
 * most people here would send it on), otherwise the link is copied with a short
 * "copied" confirmation. Shares the page's own URL and nothing else.
 */
export default function ShareButton({
  title,
  label,
  copiedLabel,
}: {
  title: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or refused — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // No clipboard access either: nothing sensible left to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-charcoal-600/15 bg-cream-50 px-4 py-2 text-sm font-semibold text-charcoal-600 transition-colors hover:border-charcoal-600/40"
    >
      {copied ? <Check size={15} className="text-success" aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
