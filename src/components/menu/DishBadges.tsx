import { useTranslations } from "next-intl";
import { Award, ChefHat } from "lucide-react";

/**
 * "Chef's pick" (set by the owner) and "Bestseller" (counted from paid orders — see
 * lib/bestsellers.ts). Plain component, so the same pills render on the server
 * (homepage, dish page) and inside the client-side menu grid.
 */
export default function DishBadges({
  chefsPick,
  bestseller,
  compact = false,
  className = "",
}: {
  chefsPick: boolean;
  bestseller: boolean;
  /** Icon-only on a narrow card; the word stays reachable through `title`. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("menu");
  if (!chefsPick && !bestseller) return null;

  const pill =
    "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm";
  const sizing = compact ? "p-1.5 text-[0.6rem]" : "px-2.5 py-1 text-[0.65rem]";

  return (
    <span className={`flex flex-wrap gap-1.5 ${className}`}>
      {bestseller && (
        <span className={`${pill} ${sizing} bg-ember-600 text-cream-50`} title={t("bestseller")}>
          <Award size={12} aria-hidden="true" />
          <span className={compact ? "sr-only" : ""}>{t("bestseller")}</span>
        </span>
      )}
      {chefsPick && (
        <span className={`${pill} ${sizing} bg-charcoal-700/90 text-cream-50`} title={t("chefsPick")}>
          <ChefHat size={12} aria-hidden="true" />
          <span className={compact ? "sr-only" : ""}>{t("chefsPick")}</span>
        </span>
      )}
    </span>
  );
}
