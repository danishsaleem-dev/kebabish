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
