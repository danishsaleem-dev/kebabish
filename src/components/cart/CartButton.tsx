"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * Header cart button. The count only appears once the cart has been read
 * from localStorage — rendering it during SSR would mean the server says
 * "0" and the client says "3", which React flags as a hydration mismatch.
 */
export default function CartButton({ onHero }: { onHero: boolean }) {
  const t = useTranslations("cart");
  const { count, ready, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={t("open")}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 ${
        onHero
          ? "border-cream-100/30 text-cream-100 hover:bg-cream-100/10"
          : "border-charcoal-600/20 text-charcoal-600 hover:bg-cream-100"
      }`}
    >
      <ShoppingBag size={18} />
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-600 px-1 text-[0.65rem] font-bold tabular-nums text-cream-50">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
