"use client";

import { useActionState, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useFormStatus } from "react-dom";
import { Link } from "@/i18n/navigation";
import { useCart, lineTotal } from "@/components/cart/CartProvider";
import { formatEuro } from "@/lib/money";
import {
  checkoutAction,
  type CheckoutState,
} from "@/app/[locale]/(site)/checkout/actions";

const EMPTY: CheckoutState = { ok: false };

export default function CheckoutForm({
  deliveryFee,
  freeDeliveryOver,
  minimumOrder,
  pickupAddress,
  deliveryTowns,
}: {
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minimumOrder: number;
  pickupAddress: string;
  deliveryTowns: string[];
}) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const { lines, subtotal, ready } = useCart();
  const [state, formAction] = useActionState(checkoutAction, EMPTY);
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">(
    "delivery"
  );

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

  const isDelivery = fulfilment === "delivery";
  const qualifiesFree =
    freeDeliveryOver != null && subtotal >= freeDeliveryOver;
  const fee = isDelivery && !qualifiesFree ? deliveryFee : 0;
  const total = subtotal + fee;
  const belowMinimum = isDelivery && subtotal < minimumOrder;

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
      <input type="hidden" name="fulfilment" value={fulfilment} />
      <input type="hidden" name="locale" value={locale} />

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
            {t("fulfilment")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["delivery", "pickup"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFulfilment(mode)}
                aria-pressed={fulfilment === mode}
                className={`rounded-2xl border px-5 py-4 text-left font-display text-sm font-semibold transition-colors ${
                  fulfilment === mode
                    ? "border-ember-600 bg-ember-600/5 text-charcoal-600"
                    : "border-charcoal-600/15 bg-cream-50 text-charcoal-600/70 hover:border-charcoal-600/30"
                }`}
              >
                {t(mode)}
              </button>
            ))}
          </div>

          {!isDelivery && (
            <p className="mt-3 text-sm text-ink/60">
              {t("pickupNote", { address: pickupAddress })}
            </p>
          )}
        </section>

        {isDelivery && (
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
        )}

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

        <dl className="mt-5 space-y-2 border-t border-charcoal-600/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/65">{tCart("subtotal")}</dt>
            <dd className="tabular-nums text-charcoal-600">
              {formatEuro(subtotal)}
            </dd>
          </div>
          {isDelivery && (
            <div className="flex justify-between">
              <dt className="text-ink/65">{tCart("deliveryFee")}</dt>
              <dd className="tabular-nums text-charcoal-600">
                {fee === 0 ? tCart("free") : formatEuro(fee)}
              </dd>
            </div>
          )}
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
