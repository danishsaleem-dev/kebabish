"use client";

import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

/**
 * "Payment received — opening your account." Shown over the confirmation page right after
 * an order has created the buyer's account, then it goes to `/api/account/enter`, which
 * signs them in and lands them on their dashboard.
 *
 * Why a short screen and not a server redirect: the confirmation page is also where the
 * basket is emptied and the order is remembered for "Order again" (both client-side, in
 * the same render). Redirecting before the page rendered would skip them — the buyer would
 * land on their dashboard with a full basket. The wait gives those a moment to finish.
 * Without JavaScript the page simply shows as normal, with the button below.
 */
export default function EnterDashboard({
  href,
  title,
  text,
  cta,
  delayMs = 1100,
}: {
  href: string;
  title: string;
  text: string;
  cta: string;
  delayMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.assign(href), delayMs);
    return () => window.clearTimeout(timer);
  }, [href, delayMs]);

  return (
    <div
      role="status"
      className="print:hidden fixed inset-0 z-[95] flex items-center justify-center bg-cream-200/95 p-6 backdrop-blur-sm animate-[media-fade-in_0.3s_ease-out_both]"
    >
      <div className="w-full max-w-sm rounded-3xl bg-cream-50 p-8 text-center shadow-2xl shadow-charcoal-950/15 ring-1 ring-charcoal-600/8">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 size={32} aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-charcoal-600">{title}</h2>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-ink/65">
          <Loader2 size={15} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          {text}
        </p>
        <a
          href={href}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-ember-600 px-6 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {cta}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
