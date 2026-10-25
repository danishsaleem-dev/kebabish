"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { formatEuro } from "@/lib/money";
import { useLastOrder } from "@/components/reorder/last-order";
import { useReorder } from "@/components/reorder/useReorder";
import BrandLogo from "@/components/shared/BrandLogo";

/**
 * "Welcome back — the same again?" for someone who has ordered on this device before.
 * One tap rebuilds that order against today's menu (see lib/reorder.ts) and opens the
 * basket. Renders nothing at all for a first-time visitor, and nothing on the server
 * (the last order lives in this browser only), so it never shows up in the crawled page.
 */
export default function ReorderCard({
  variant = "full",
  className = "",
}: {
  /** "full" = the homepage card; "compact" = a single slim row (menu page). */
  variant?: "full" | "compact";
  className?: string;
}) {
  const t = useTranslations("reorder");
  const locale = useLocale();
  const last = useLastOrder();
  const { state, run } = useReorder();

  if (!last) return null;

  const date = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
  }).format(new Date(last.at));
  const shown = last.items.slice(0, 2);
  const rest = last.items.length - shown.length;
  const summary =
    shown.map((i) => `${i.quantity}× ${i.name}`).join(", ") +
    (rest > 0 ? ` ${t("more", { count: rest })}` : "");
  const photos = last.items.filter((i) => i.image).slice(0, 3);

  const button = (
    <button
      type="button"
      disabled={state.status === "loading"}
      onClick={() => run(last.ref, last.token)}
      className={`group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-ember-600 font-display font-semibold text-cream-50 shadow-lg shadow-ember-900/25 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 disabled:translate-y-0 disabled:opacity-80 ${
        variant === "full" ? "w-full px-6 py-3.5 text-sm sm:w-auto" : "px-4 py-2.5 text-xs"
      }`}
    >
      {state.status === "loading" ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : state.status === "done" && state.added > 0 ? (
        <Check size={16} aria-hidden="true" />
      ) : (
        <RotateCcw
          size={16}
          aria-hidden="true"
          className="transition-transform duration-500 group-hover:-rotate-180"
        />
      )}
      {state.status === "loading" ? t("loading") : t("cta")}
    </button>
  );

  const feedback =
    state.status === "done" ? (
      <p role="status" className="text-xs leading-snug">
        {state.added > 0 ? (
          <span className="font-semibold text-success">{t("added")}</span>
        ) : (
          <span className="text-cream-200/80">{t("noneAvailable")}</span>
        )}
        {state.added > 0 && state.skipped.length > 0 && (
          <span className="block text-cream-200/70">
            {t("skipped", { names: state.skipped.join(", ") })}
          </span>
        )}
      </p>
    ) : state.status === "error" ? (
      <p role="alert" className="text-xs text-cream-200/80">
        {t("error")}
      </p>
    ) : null;

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl bg-charcoal-800 p-3 pl-4 text-cream-100 shadow-lg shadow-charcoal-950/15 animate-[media-fade-in_0.4s_ease-out_both] ${className}`}
      >
        <RotateCcw size={18} aria-hidden="true" className="shrink-0 text-ember-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t("title")}</p>
          {feedback ?? <p className="truncate text-xs text-cream-200/65">{summary}</p>}
        </div>
        {button}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-charcoal-800 p-5 text-cream-100 shadow-xl shadow-charcoal-950/15 animate-[media-fade-in_0.5s_ease-out_both] sm:p-6 ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgba(169,80,38,0.35),transparent_70%)]"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Overlapping dish photos — "your usual" at a glance. */}
        <div className="flex shrink-0 -space-x-4">
          {(photos.length > 0 ? photos : [{ name: "", image: undefined }]).map((p, i) => (
            <span
              key={i}
              className="relative h-14 w-14 overflow-hidden rounded-full bg-cream-300 ring-4 ring-charcoal-800 sm:h-16 sm:w-16"
              style={{ zIndex: 3 - i }}
            >
              {p.image ? (
                <Image src={p.image} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <BrandLogo
                    src="/logo/Kebabish-light.png"
                    alt=""
                    width={120}
                    height={90}
                    className="h-auto w-9 opacity-40"
                  />
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ember-400">
            {t("eyebrow")}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-cream-50 sm:text-xl">
            {t("title")}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-cream-200/70">{summary}</p>
          <p className="mt-1 text-xs text-cream-200/45">
            {t("lastOrder", { date })}
            {last.totalCents > 0 && ` · ${formatEuro(last.totalCents / 100)}`}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {button}
          {feedback}
        </div>
      </div>
    </div>
  );
}
