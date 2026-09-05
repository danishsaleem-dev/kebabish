"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart, lineTotal } from "@/components/cart/CartProvider";
import { formatEuro } from "@/lib/money";

/**
 * The full cart page. Totals shown here are indicative — checkout
 * recomputes every price server-side from the store before charging
 * anything, so a tampered localStorage can't change what's owed.
 */
export default function CartView({
  deliveryFee,
  freeDeliveryOver,
  minimumOrder,
}: {
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minimumOrder: number;
}) {
  const t = useTranslations("cart");
  const { lines, subtotal, ready, setQuantity, remove } = useCart();

  // Until localStorage has been read the cart is empty on both server and
  // client; showing "your cart is empty" in that gap would flash wrongly.
  if (!ready) {
    return <div className="min-h-[40vh]" aria-hidden="true" />;
  }

  if (lines.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <ShoppingBag size={36} className="text-ink/25" aria-hidden="true" />
        <p className="font-display text-xl font-semibold text-charcoal-600">
          {t("empty")}
        </p>
        <p className="text-base text-ink/55">{t("emptyHint")}</p>
        <Link
          href="/menu"
          className="mt-3 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const qualifiesFree =
    freeDeliveryOver != null && subtotal >= freeDeliveryOver;
  const fee = qualifiesFree ? 0 : deliveryFee;
  const belowMinimum = subtotal < minimumOrder;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
      <ul className="divide-y divide-charcoal-600/10">
        {lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-start justify-between gap-4 py-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-charcoal-600">
                {line.name}
              </p>
              {line.options.length > 0 && (
                <p className="mt-1 text-sm leading-snug text-ink/60">
                  {line.options
                    .map((o) =>
                      o.price > 0
                        ? `${o.optionLabel} (+${formatEuro(o.price)})`
                        : o.optionLabel
                    )
                    .join(", ")}
                </p>
              )}
              {line.instructions && (
                <p className="mt-1 text-sm italic leading-snug text-ink/50">
                  “{line.instructions}”
                </p>
              )}

              <div className="mt-3 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantity(line.id, line.quantity - 1)}
                  aria-label={t("decrease")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-colors hover:bg-cream-100"
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
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-colors hover:bg-cream-100"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  aria-label={`${t("remove")} ${line.name}`}
                  className="ml-3 flex h-9 w-9 items-center justify-center rounded-full text-ink/40 transition-colors hover:text-red-700"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <span className="font-display text-base font-semibold tabular-nums text-charcoal-600">
              {formatEuro(lineTotal(line))}
            </span>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 lg:sticky lg:top-28">
        <h2 className="font-display text-lg font-semibold text-charcoal-600">
          {t("title")}
        </h2>

        <dl className="mt-5 space-y-2.5 text-[0.95rem]">
          <div className="flex justify-between">
            <dt className="text-ink/65">{t("subtotal")}</dt>
            <dd className="font-medium tabular-nums text-charcoal-600">
              {formatEuro(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/65">{t("deliveryFee")}</dt>
            <dd className="font-medium tabular-nums text-charcoal-600">
              {fee === 0 ? t("free") : formatEuro(fee)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-between border-t border-charcoal-600/10 pt-4 font-display text-lg font-semibold text-charcoal-600">
          <span>{t("total")}</span>
          <span className="tabular-nums">{formatEuro(subtotal + fee)}</span>
        </div>

        {!qualifiesFree && freeDeliveryOver != null && (
          <p className="mt-3 text-sm text-ink/55">
            {t("freeDeliveryHint", {
              missing: formatEuro(freeDeliveryOver - subtotal),
            })}
          </p>
        )}

        {belowMinimum ? (
          <p className="mt-5 rounded-2xl bg-ember-600/10 px-4 py-3 text-sm text-ember-700">
            {t("minimumOrder", {
              amount: formatEuro(minimumOrder),
              missing: formatEuro(minimumOrder - subtotal),
            })}
          </p>
        ) : (
          <Link
            href="/checkout"
            className="mt-5 block rounded-full bg-ember-600 px-6 py-4 text-center font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            {t("checkout")}
          </Link>
        )}

        <Link
          href="/menu"
          className="mt-3 block text-center text-sm font-semibold text-charcoal-600/70 transition-colors hover:text-charcoal-600"
        >
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
