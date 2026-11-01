"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/components/cart/CartProvider";
import { toCents } from "@/lib/money";
import { earnedPoints } from "@/lib/rewards-math";
import { useIsGuest } from "@/components/rewards/useIsGuest";

/** "Earn 260 Kebabish Punten with this order", under the basket total. Nothing while rewards are off. */
export default function PointsHint({ className = "" }: { className?: string }) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { rewards, subtotal } = useCart();
  if (!rewards) return null;
  const points = earnedPoints(toCents(subtotal), 0, rewards);
  if (points <= 0) return null;

  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium text-ember-700 ${className}`}>
      <Sparkles size={13} aria-hidden="true" className="shrink-0" />
      {t("pointsEarn", { points: points.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB") })}
    </p>
  );
}
