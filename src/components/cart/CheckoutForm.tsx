"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useFormStatus } from "react-dom";
import { Tag, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart, lineTotal } from "@/components/cart/CartProvider";
import { formatEuro, toCents, fromCents } from "@/lib/money";
import {
  checkoutAction,
  checkPromoCodeAction,
  type CheckoutState,
} from "@/app/[locale]/(site)/checkout/actions";

const EMPTY: CheckoutState = { ok: false };

interface AppliedPromo {
  code: string;
  discountCents: number;
}

export default function CheckoutForm({
  deliveryFee,
  freeDeliveryOver,
  minimumOrder,
  deliveryTowns,
}: {
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minimumOrder: number;
  deliveryTowns: string[];
}) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const { lines, subtotal, ready } = useCart();
  const [state, formAction] = useActionState(checkoutAction, EMPTY);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, startPromoTransition] = useTransition();

  if (!ready) return <div className="min-h-[40vh]" aria-hidden="true" />;

  if (lines.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-xl font-semibold text-charcoal-600">
          {tCart("empty")}
        </p>
        <Link
          href="/menu"
          className="mt-2 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {tCart("continueShopping")}
        </Link>
      </div>
    );
  }

  const qualifiesFree =
    freeDeliveryOver != null && subtotal >= freeDeliveryOver;
  const fee = qualifiesFree ? 0 : deliveryFee;
  const discount = promo ? Math.min(fromCents(promo.discountCents), subtotal) : 0;
  const total = Math.max(subtotal - discount + fee, 0);
  const belowMinimum = subtotal < minimumOrder;

  function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    startPromoTransition(async () => {
      const result = await checkPromoCodeAction(code, toCents(subtotal));
      if (result.ok && result.code && result.discountCents != null) {
        setPromo({ code: result.code, discountCents: result.discountCents });
        setPromoError(null);
      } else {
        setPromo(null);
        setPromoError(result.error ?? "notFound");
      }
    });
  }

  function removePromo() {
    setPromo(null);
    setPromoError(null);
    setPromoInput("");
  }

  // Only what was ordered — never prices. The server rebuilds those.
  const cartPayload = JSON.stringify(
    lines.map((l) => ({
      slug: l.slug,
      quantity: l.quantity,
      instructions: l.instructions,
      options: l.options.map((o) => ({
        groupId: o.groupId,
        optionId: o.optionId,
      })),
    }))
  );

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <input type="hidden" name="cart" value={cartPayload} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="promoCode" value={promo?.code ?? ""} />

      <div className="space-y-8">
        <section>
          <h2 className="font-display text-lg font-semibold text-charcoal-600">
            {t("yourDetails")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} className="sm:col-span-2">
              <input name="name" required autoComplete="name" className={inputClass} />
            </Field>
            <Field label={t("email")}>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>
            <Field label={t("phone")}>
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-charcoal-600">
            {t("address")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("street")} className="sm:col-span-2">
              <input
                name="street"
                required
                autoComplete="street-address"
                className={inputClass}
              />
            </Field>
            <Field label={t("postcode")}>
              <input
                name="postcode"
                required
                autoComplete="postal-code"
                className={inputClass}
              />
            </Field>
            <Field label={t("city")}>
              {/* A list, not a free-text box: it's also the delivery-area
                  check, and the server re-validates the same way. */}
              <select
                name="city"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled />
                {deliveryTowns.map((town) => (
                  <option key={town} value={town}>
                    {town}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-charcoal-600">
            {t("notes")}
          </h2>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder={t("notesPlaceholder")}
            className={`mt-4 ${inputClass} h-auto py-3`}
          />
        </section>
      </div>

      <aside className="h-fit rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 lg:sticky lg:top-28">
        <h2 className="font-display text-lg font-semibold text-charcoal-600">
          {t("summary")}
        </h2>

        <ul className="mt-4 space-y-3 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span className="text-ink/70">
                {line.quantity}× {line.name}
                {line.options.length > 0 && (
                  <span className="block text-ink/45">
                    {line.options.map((o) => o.optionLabel).join(", ")}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-charcoal-600">
                {formatEuro(lineTotal(line))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-charcoal-600/10 pt-4">
          {promo ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-ember-600/10 px-3.5 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-ember-700">
                <Tag size={14} />
                {t("promoApplied", { code: promo.code })}
              </span>
              <button
                type="button"
                onClick={removePromo}
                aria-label={t("promoRemove")}
                className="text-ember-700/70 hover:text-ember-700"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={t("promoPlaceholder")}
                aria-label={t("promoCode")}
                className="h-11 flex-1 rounded-xl border border-charcoal-600/15 bg-cream-50 px-3.5 text-sm text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={promoPending || !promoInput.trim()}
                className="shrink-0 rounded-xl border border-charcoal-600/20 px-4 text-sm font-semibold text-charcoal-600 transition-colors hover:border-ember-600 hover:text-ember-600 disabled:opacity-50"
              >
                {promoPending ? t("promoChecking") : t("promoApply")}
              </button>
            </div>
          )}
          {promoError && (
            <p className="mt-2 text-xs text-red-700">
              {t(`promo${promoError.charAt(0).toUpperCase()}${promoError.slice(1)}`)}
            </p>
          )}
        </div>

        <dl className="mt-4 space-y-2 border-t border-charcoal-600/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/65">{tCart("subtotal")}</dt>
            <dd className="tabular-nums text-charcoal-600">
              {formatEuro(subtotal)}
            </dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink/65">{tCart("discount")}</dt>
              <dd className="tabular-nums text-ember-600">
                −{formatEuro(discount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink/65">{tCart("deliveryFee")}</dt>
            <dd className="tabular-nums text-charcoal-600">
              {fee === 0 ? tCart("free") : formatEuro(fee)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-between border-t border-charcoal-600/10 pt-4 font-display text-lg font-semibold text-charcoal-600">
          <span>{tCart("total")}</span>
          <span className="tabular-nums">{formatEuro(total)}</span>
        </div>

        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {t(state.error, { amount: formatEuro(minimumOrder) })}
          </p>
        )}

        {belowMinimum ? (
          <p className="mt-5 rounded-2xl bg-ember-600/10 px-4 py-3 text-sm text-ember-700">
            {tCart("minimumOrder", {
              amount: formatEuro(minimumOrder),
              missing: formatEuro(minimumOrder - subtotal),
            })}
          </p>
        ) : (
          <PayButton label={t("payNow", { amount: formatEuro(total) })} pendingLabel={t("paying")} />
        )}
      </aside>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 text-[0.95rem] text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-charcoal-600/80">
        {label}
      </span>
      {children}
    </label>
  );
}

function PayButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-full bg-ember-600 px-6 py-4 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
