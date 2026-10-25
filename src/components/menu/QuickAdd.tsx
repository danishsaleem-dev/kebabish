"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * One-tap "add to basket" on a dish card, for dishes that need no choices
 * (`PublicMenuItem.quickAdd`). A dish with a required sauce or size never gets this —
 * its card opens the dish page instead. The price comes from the menu the page was
 * rendered with; the basket re-checks it against the live menu straight away, and
 * checkout re-prices everything on the server regardless.
 *
 * A round button that sits where the card's photo meets its text, on top of the card's
 * stretched link (`relative z-10`), so tapping it adds the dish without opening the
 * page. Once the dish is in the basket it shows how many, in ember; each tap pops the
 * number and sends a ring out from the button. The mobile order bar bumps at the same
 * moment.
 */
export default function QuickAdd({
  slug,
  name,
  price,
  image,
  className = "",
}: {
  slug: string;
  name: string;
  price: number;
  image?: string;
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
      aria-label={
        inBasket > 0 ? `${t("quickAddAria", { name })} (${t("quickAdded")}: ${inBasket})` : t("quickAddAria", { name })
      }
      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-lg ring-4 ring-cream-50 transition-[background-color,transform,box-shadow] duration-300 ease-brand hover:scale-110 active:scale-90 @min-[16rem]:h-12 @min-[16rem]:w-12 ${
        inBasket > 0
          ? "bg-ember-600 text-cream-50 shadow-ember-800/35"
          : "bg-charcoal-700 text-cream-50 shadow-charcoal-950/25 group-hover:bg-ember-600"
      } ${className}`}
    >
      {pop > 0 && (
        <span
          key={`ring-${pop}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-ember-500 animate-[add-ring_0.7s_ease-out_forwards] motion-reduce:hidden"
        />
      )}
      <span
        key={pop}
        className={`inline-flex ${pop > 0 ? "animate-[quick-pop_0.45s_var(--ease-brand)] motion-reduce:animate-none" : ""}`}
      >
        {inBasket > 0 ? (
          <span className="font-display text-sm font-bold tabular-nums @min-[16rem]:text-base">{inBasket}</span>
        ) : (
          <Plus size={20} strokeWidth={2.75} aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
