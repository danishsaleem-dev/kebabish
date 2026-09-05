"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart, lineTotal } from "@/components/cart/CartProvider";
import { formatEuro } from "@/lib/money";

/** Slide-in order summary. Mounted once, in the site layout. */
export default function CartDrawer() {
  const t = useTranslations("cart");
  const { lines, subtotal, count, drawerOpen, closeDrawer, setQuantity, remove } =
    useCart();

  // Escape closes it, and the page behind shouldn't scroll while it's open.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label={t("close")}
        onClick={closeDrawer}
        className="absolute inset-0 bg-charcoal-950/45 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream-100 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-charcoal-600/10 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-charcoal-600">
            {t("title")}
            <span className="ml-2 text-sm font-medium text-ink/50">
              {t("itemCount", { count })}
            </span>
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t("close")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-300"
          >
            <X size={20} />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <ShoppingBag size={32} className="text-ink/25" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-charcoal-600">
              {t("empty")}
            </p>
            <p className="text-sm text-ink/55">{t("emptyHint")}</p>
            <Link
              href="/menu"
              onClick={closeDrawer}
              className="mt-2 rounded-full bg-charcoal-600 px-6 py-3 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
            >
              {t("continueShopping")}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-charcoal-600/10 overflow-y-auto px-5">
              {lines.map((line) => (
                <li key={line.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[0.95rem] font-semibold text-charcoal-600">
                        {line.name}
                      </p>
                      {line.options.length > 0 && (
                        <p className="mt-1 text-sm leading-snug text-ink/55">
                          {line.options.map((o) => o.optionLabel).join(", ")}
                        </p>
                      )}
                      {line.instructions && (
                        <p className="mt-1 text-sm italic leading-snug text-ink/50">
                          “{line.instructions}”
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-charcoal-600">
                      {formatEuro(lineTotal(line))}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.id, line.quantity - 1)}
                      aria-label={t("decrease")}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-colors hover:bg-cream-300"
                    >
                      <Minus size={14} />
                    </button>
                    <span
                      aria-label={t("quantity")}
                      className="w-9 text-center text-sm font-semibold tabular-nums text-charcoal-600"
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      aria-label={t("increase")}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-colors hover:bg-cream-300"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      aria-label={`${t("remove")} ${line.name}`}
                      className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink/40 transition-colors hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-charcoal-600/10 px-5 py-4">
              <div className="flex items-center justify-between font-display text-base font-semibold text-charcoal-600">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{formatEuro(subtotal)}</span>
              </div>
              <div className="mt-4 grid gap-2">
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className="rounded-full bg-ember-600 px-6 py-3.5 text-center font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
                >
                  {t("viewCart")}
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full px-6 py-2.5 text-center font-display text-sm font-semibold text-charcoal-600/70 transition-colors hover:text-charcoal-600"
                >
                  {t("continueShopping")}
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
