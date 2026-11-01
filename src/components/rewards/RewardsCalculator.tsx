"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatEuro, fromCents } from "@/lib/money";
import { earnedPoints, valueOfPoints, type RewardsConfig } from "@/lib/rewards-math";

/** More segments than this stops reading as a row of orders. */
const MAX_SEGMENTS = 10;

/**
 * "What's in it for you?" on /rewards. Two sliders, three results, all worked out with the same
 * functions checkout uses, from the rates set in the admin, so it can never promise more than
 * an order would really earn. The starting values are in the server HTML like any other text.
 */
export default function RewardsCalculator({ config }: { config: RewardsConfig }) {
  const t = useTranslations("rewards");
  const locale = useLocale();
  const id = useId();
  const [orderEuros, setOrderEuros] = useState(25);
  const [perMonth, setPerMonth] = useState(2);

  const perOrder = earnedPoints(orderEuros * 100, 0, config);
  const ordersNeeded = perOrder > 0 ? Math.ceil(config.redeemStepPoints / perOrder) : 0;
  const yearCents = valueOfPoints(perOrder * perMonth * 12, config);
  const segments = Math.min(ordersNeeded, MAX_SEGMENTS);

  return (
    <div className="rounded-[2rem] bg-cream-50 p-5 text-charcoal-700 shadow-2xl shadow-charcoal-950/30 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Slider
          id={`${id}-order`}
          label={t("calcOrder")}
          display={formatEuro(orderEuros)}
          min={10}
          max={80}
          step={1}
          value={orderEuros}
          onChange={setOrderEuros}
        />
        <Slider
          id={`${id}-frequency`}
          label={t("calcFrequency")}
          display={String(perMonth)}
          min={1}
          max={8}
          step={1}
          value={perMonth}
          onChange={setPerMonth}
        />
      </div>

      <dl aria-live="polite" className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-cream-200/70 p-4">
          <dt className="text-xs font-medium text-ink/60">{t("calcPerOrder")}</dt>
          <dd className="mt-1 font-display text-3xl font-semibold tabular-nums text-charcoal-700">
            {perOrder.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB")}
          </dd>
        </div>
        <div className="rounded-2xl bg-ember-600 p-4 text-cream-50">
          <dt className="text-xs font-medium text-cream-50/80">{t("calcYear")}</dt>
          <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {formatEuro(fromCents(yearCents))}
          </dd>
        </div>
      </dl>

      {ordersNeeded > 0 && (
        <div className="mt-6">
          <div aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} className="h-2 flex-1 rounded-full bg-ember-600" />
            ))}
          </div>
          <p className="mt-2.5 text-sm font-semibold text-charcoal-600">
            {t("calcOrdersNeeded", {
              count: ordersNeeded,
              amount: formatEuro(fromCents(config.redeemStepCents)),
            })}
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-ink/55">{t("calcNote")}</p>
    </div>
  );
}

function Slider({
  id,
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink/70">
          {label}
        </label>
        <span className="font-display text-xl font-semibold tabular-nums text-charcoal-700">{display}</span>
      </div>
      {/* Tall so the thumb is easy to catch with a thumb on a phone. */}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-8 w-full cursor-pointer accent-ember-600"
      />
    </div>
  );
}
