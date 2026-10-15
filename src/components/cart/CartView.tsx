"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  BikeIcon,
  Clock,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart, lineTotal, type CartLine } from "@/components/cart/CartProvider";
import CartLineNotice from "@/components/cart/CartLineNotice";
import BrandLogo from "@/components/shared/BrandLogo";
import { formatEuro } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

/**
 * The full cart page. Totals shown here are indicative — checkout
 * recomputes every price server-side from the store before charging
 * anything, so a tampered localStorage can't change what's owed.
 *
 * Each line is a card with the dish's photo, because a basket that is only a
 * list of names makes people scroll back to the menu to check what they
 * picked. The summary sticks beside it on desktop and, when free delivery is
 * within reach, shows how close they are — the one number in the basket that
 * changes behaviour.
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
  const { lines, subtotal, count, ready, setQuantity, remove, issues, repriced, blocked, promoCode, setPromoCode } =
    useCart();

  // Until localStorage has been read the cart is empty on both server and
  // client; showing "your cart is empty" in that gap would flash wrongly.
  if (!ready) {
    return <div className="min-h-[40vh]" aria-hidden="true" />;
  }

  if (lines.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-3xl border border-charcoal-600/10 bg-cream-50 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-200">
          <ShoppingBag size={28} className="text-charcoal-600/45" aria-hidden="true" />
        </span>
        <p className="mt-1 font-display text-xl font-semibold text-charcoal-600">
          {t("empty")}
        </p>
        <p className="max-w-sm text-base text-ink/55">{t("emptyHint")}</p>
        <Link
          href="/menu"
          className="mt-3 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const qualifiesFree = freeDeliveryOver != null && subtotal >= freeDeliveryOver;
  const fee = qualifiesFree ? 0 : deliveryFee;
  const belowMinimum = subtotal < minimumOrder;

  // Only worth showing when there is actually a fee to lose and a threshold
  // to cross; with free delivery for everyone it would be noise.
  const showFreeProgress = freeDeliveryOver != null && deliveryFee > 0;
  const progress = showFreeProgress
    ? Math.min(100, Math.round((subtotal / freeDeliveryOver!) * 100))
    : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-12">
      <div>
        <p className="text-sm font-medium text-ink/55">{t("itemCount", { count })}</p>

        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex gap-3 rounded-2xl border border-charcoal-600/10 bg-cream-50 p-3 sm:gap-4 sm:p-4"
            >
              <LineThumbnail line={line} />

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/menu/${line.slug}`}
                      className="font-display text-base font-semibold leading-snug text-charcoal-600 transition-colors hover:text-ember-700"
                    >
                      {line.name}
                    </Link>

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
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="font-display text-base font-semibold tabular-nums text-charcoal-600">
                      {formatEuro(lineTotal(line))}
                    </span>
                    {/* Only when it isn't already the line total — on a
                        quantity of one it would just repeat the number. */}
                    {line.quantity > 1 && (
                      <span className="mt-0.5 block text-xs tabular-nums text-ink/45">
                        {formatEuro(lineTotal(line) / line.quantity)} {t("each")}
                      </span>
                    )}
                  </div>
                </div>

                <CartLineNotice issue={issues[line.id]} repriced={repriced.includes(line.id)} />

                <div className="mt-3 flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1 rounded-full border border-charcoal-600/15 bg-cream-100 p-0.5">
                    <StepperButton
                      label={t("decrease")}
                      onClick={() => setQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus size={14} />
                    </StepperButton>
                    <span
                      aria-label={t("quantity")}
                      className="w-8 text-center text-sm font-semibold tabular-nums text-charcoal-600"
                    >
                      {line.quantity}
                    </span>
                    <StepperButton
                      label={t("increase")}
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </StepperButton>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.id)}
                    aria-label={`${t("remove")} ${line.name}`}
                    className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink/45 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">{t("remove")}</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Link
          href="/menu"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-charcoal-600/70 transition-colors hover:text-ember-700"
        >
          ← {t("continueShopping")}
        </Link>
      </div>

      <aside className="h-fit rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 lg:sticky lg:top-28">
        <h2 className="font-display text-lg font-semibold text-charcoal-600">
          {t("summaryTitle")}
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
            <dd
              className={`font-medium tabular-nums ${
                fee === 0 ? "text-green-700" : "text-charcoal-600"
              }`}
            >
              {fee === 0 ? t("free") : formatEuro(fee)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-between border-t border-charcoal-600/10 pt-4 font-display text-xl font-semibold text-charcoal-600">
          <span>{t("total")}</span>
          <span className="tabular-nums">{formatEuro(subtotal + fee)}</span>
        </div>

        {promoCode && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ember-600/10 px-4 py-3 text-sm text-ember-700">
            <span className="inline-flex items-center gap-2">
              <Tag size={15} className="shrink-0" />
              {t("promoWaiting", { code: promoCode })}
            </span>
            <button
              type="button"
              onClick={() => setPromoCode(null)}
              aria-label={t("promoDrop")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ember-600/15"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {showFreeProgress && (
          <div className="mt-5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-charcoal-600/10"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-ember-600 transition-[width] duration-500 ease-brand"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-ink/60">
              {qualifiesFree
                ? t("freeDeliveryReached")
                : t("freeDeliveryProgress", {
                    missing: formatEuro(freeDeliveryOver! - subtotal),
                  })}
            </p>
          </div>
        )}

        {belowMinimum ? (
          <p className="mt-5 rounded-2xl bg-ember-600/10 px-4 py-3 text-sm text-ember-700">
            {t("minimumOrder", {
              amount: formatEuro(minimumOrder),
              missing: formatEuro(minimumOrder - subtotal),
            })}
          </p>
        ) : blocked ? (
          // A dish in the basket can't be ordered any more: no way forward
          // until it's removed. The rest of the basket stays exactly as it is.
          <>
            <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {t("blockedNotice")}
            </p>
            <span
              aria-disabled="true"
              className="mt-3 block cursor-not-allowed rounded-full bg-charcoal-600/20 px-6 py-4 text-center font-display text-sm font-semibold text-charcoal-600/50"
            >
              {t("checkout")}
            </span>
          </>
        ) : (
          <Link
            href="/checkout"
            className="mt-5 block rounded-full bg-ember-600 px-6 py-4 text-center font-display text-sm font-semibold text-cream-50 shadow-sm transition-[background-color,translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 hover:shadow-lg hover:shadow-ember-800/25"
          >
            {t("checkout")} · {formatEuro(subtotal + fee)}
          </Link>
        )}

        <ul className="mt-6 space-y-2.5 border-t border-charcoal-600/10 pt-5 text-xs leading-relaxed text-ink/55">
          <Reassurance icon={<Clock size={14} />}>{t("slotNote")}</Reassurance>
          <Reassurance icon={<BikeIcon size={14} />}>
            {t("deliveryOnlyNote", { radius: siteConfig.deliveryRadiusKm })}
          </Reassurance>
          <Reassurance icon={<ShieldCheck size={14} />}>{t("securePaymentNote")}</Reassurance>
        </ul>
      </aside>
    </div>
  );
}

/** The dish photo, or a branded tile for a dish that has none. */
function LineThumbnail({ line }: { line: CartLine }) {
  return (
    <Link
      href={`/menu/${line.slug}`}
      aria-hidden="true"
      tabIndex={-1}
      className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-300 sm:h-24 sm:w-24"
    >
      {line.image ? (
        <Image src={line.image} alt="" fill sizes="96px" className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-cream-300),var(--color-cream-200))]">
          <BrandLogo
            src="/logo/Kebabish-light.png"
            alt=""
            width={160}
            height={120}
            className="h-auto w-10 opacity-30"
          />
        </span>
      )}
    </Link>
  );
}

function StepperButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-50"
    >
      {children}
    </button>
  );
}

function Reassurance({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-ember-600">
        {icon}
      </span>
      {children}
    </li>
  );
}
