"use client";

import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { useIsGuest } from "@/components/rewards/useIsGuest";

/** One line above the menu for a signed-out visitor: what an account is worth. */
export default function RewardsStrip() {
  const t = useTranslations("rewards");
  const locale = useLocale();
  const { rewards } = useCart();
  const guest = useIsGuest();
  if (!rewards || !guest) return null;

  const points = rewards.welcomePoints.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-charcoal-800 px-4 py-3 text-cream-100 sm:flex-row sm:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm leading-snug">
        <Sparkles size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ember-400" />
        {rewards.welcomePoints > 0 ? t("stripText", { points }) : t("stripTextPlain")}
      </p>
      <NextLink
        href={`/signup?lang=${locale}`}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-ember-600 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-ember-500"
      >
        {t("stripCta")}
      </NextLink>
    </div>
  );
}
