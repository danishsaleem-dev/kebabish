"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import DeliverySlotPicker, { type DeliverySlotValue } from "@/components/cart/DeliverySlotPicker";
import { retryPaymentAction } from "@/app/[locale]/(site)/checkout/actions";
import type { StoredSettings } from "@/lib/admin/store/types";

/**
 * Pay for an order whose payment didn't complete. When its delivery time no longer works,
 * the same day-and-time picker as checkout appears and the new time goes with the payment.
 */
export default function RetryPaymentForm({
  reference,
  token,
  locale,
  label,
  picker,
}: {
  reference: string;
  token: string;
  locale: string;
  label: string;
  /** Set when the customer has to choose a new delivery time first. */
  picker: { hours: StoredSettings["hours"]; windowDays: number; hint: string } | null;
}) {
  const [slot, setSlot] = useState<DeliverySlotValue | null>(null);

  return (
    <form action={retryPaymentAction} className="flex w-full flex-col items-center gap-4">
      <input type="hidden" name="ref" value={reference} />
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="locale" value={locale} />
      {picker && (
        <div className="w-full text-left">
          <p className="mb-4 text-center text-sm font-medium text-charcoal-600">{picker.hint}</p>
          <DeliverySlotPicker
            hours={picker.hours}
            windowDays={picker.windowDays}
            value={slot}
            onChange={setSlot}
          />
        </div>
      )}
      <Submit label={label} disabled={!!picker && !slot} />
    </form>
  );
}

function Submit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-full bg-ember-600 px-7 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-700 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
