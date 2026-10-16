"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";

/**
 * What a visitor sees when something unexpected breaks on a page, instead of
 * Next's bare default. It tells them what to do (try again, or reach us — and
 * the WhatsApp/phone order route is always still there) rather than leaving
 * them at a dead end mid-order.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error("[page error]", error);

    // A tab that was open while the site was updated asks for scripts that no longer
    // exist. That is not a bug a visitor can act on: reload once to pick up the new
    // version (guarded, so a genuine failure can't loop).
    const stale =
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(
        `${error.name} ${error.message}`
      );
    if (stale) {
      try {
        const last = Number(window.sessionStorage.getItem("kebabish-error-reload") ?? 0);
        if (Date.now() - last > 60_000) {
          window.sessionStorage.setItem("kebabish-error-reload", String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // No session storage: fall through and show the page.
      }
    }

    // Tell the server what broke (one log line, no personal data) — without it, an error that
    // only happens in somebody's browser leaves us nothing but a screenshot.
    let cart = "none";
    try {
      const raw = window.localStorage.getItem("kebabish-cart-v1");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        cart = Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed;
      }
    } catch {
      cart = "unreadable";
    }
    try {
      void fetch("/api/client-error", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          name: error.name,
          digest: error.digest,
          stack: error.stack,
          path: window.location.pathname,
          cart,
        }),
      }).catch(() => {});
    } catch {
      // Reporting must never make things worse.
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold text-charcoal-600">{t("title")}</h1>
      <p className="mt-4 text-base text-ink/70">{t("text")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {t("retry")}
        </button>
        <a
          href={whatsappOrderLink(t("whatsappMessage"))}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-charcoal-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-charcoal-500"
        >
          {t("whatsapp")}
        </a>
        <a
          href={`tel:${siteConfig.contact.phone.replace(/[^\d+]/g, "")}`}
          className="rounded-full border border-charcoal-600/25 px-7 py-3.5 font-display text-sm font-semibold text-charcoal-600 transition-colors hover:border-charcoal-600"
        >
          {siteConfig.contact.phone}
        </a>
      </div>
    </div>
  );
}
