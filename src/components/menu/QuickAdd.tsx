"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * One-tap "add to basket" on a dish card, for dishes that need no choices
 * (`PublicMenuItem.quickAdd`). A dish with a required sauce or size never gets this —
 * its card opens the dish page instead. The price comes from the menu the page was
 * rendered with; the basket re-checks it against the live menu straight away, and
 * checkout re-prices everything on the server regardless.
 *
 * It sits on top of the card's stretched link (`relative z-10`), so tapping it adds
 * the dish without opening the page. A short pop + "Added · 2" is the feedback; the
 * mobile order bar bumps its count at the same moment.
 */
export default function QuickAdd({
  slug,
  name,
  price,
  image,
  fluid = false,
  className = "",
}: {
  slug: string;
  name: string;
  price: number;
  image?: string;
  /**
   * Inside a dish card's `@container`: full width while the card is narrow (two per
   * row on a phone), its own size once the card is wide.
   */
  fluid?: boolean;
  className?: string;
}) {
  const t = useTranslations("menu");
  const { lines, add } = useCart();
  const [pop, setPop] = useState(0);

  const inBasket = lines
    .filter((l) => l.slug === slug && l.options.length === 0 && !l.instructions)
    .reduce((n, l) => n + l.quantity, 0);

  return (
    <button
      type="button"
      onClick={() => {
        add({ slug, name, unitPrice: price, image, options: [], instructions: "" });
        setPop((n) => n + 1);
      }}
      aria-label={t("quickAddAria", { name })}
      className={`relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-300 active:scale-95 ${
        fluid
          ? "w-full px-3 py-2 @min-[16rem]:w-auto @min-[16rem]:px-4 @min-[16rem]:py-2.5"
          : "px-4 py-2.5"
      } ${
        inBasket > 0
          ? "bg-ember-600 text-cream-50 hover:bg-ember-500"
          : "bg-charcoal-600 text-cream-100 hover:bg-ember-600"
      } ${className}`}
    >
      <span key={pop} className={pop > 0 ? "inline-flex animate-[quick-pop_0.45s_var(--ease-brand)]" : "inline-flex"}>
        {inBasket > 0 ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={2.5} />}
      </span>
      {inBasket > 0 ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {t("quickAdded")}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cream-50 px-1 text-[0.65rem] font-bold tabular-nums text-ember-700">
            {inBasket}
          </span>
        </span>
      ) : (
        <span className="whitespace-nowrap">{t("addToOrder")}</span>
      )}
    </button>
  );
}
