"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import {
  Checkbox,
  Field,
  Input,
  SubmitButton,
  Textarea,
} from "@/components/admin/ui/Form";
import { updateSettingsAction } from "@/app/admin/(dashboard)/settings/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredSettings } from "@/lib/admin/store/types";
import { useToast } from "@/components/admin/ui/Toast";

const EMPTY: FormState = { ok: false };

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export default function SettingsForm({
  settings,
}: {
  settings: StoredSettings;
}) {
  const [state, formAction] = useActionState(updateSettingsAction, EMPTY);
  const e = state.errors ?? {};

  // Held in state so toggling "Closed" can grey out the time inputs live.
  const [hours, setHours] = useState(settings.hours);
  // The placeholders in each day's override boxes follow the defaults being typed.
  const [defaultSlotMinutes, setDefaultSlotMinutes] = useState(settings.slotMinutes ?? 45);
  const [defaultSlotCapacity, setDefaultSlotCapacity] = useState(settings.slotCapacity ?? 10);
  const { toast } = useToast();

  const lastRef = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.message || lastRef.current === state) return;
    lastRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader
          title="Taking orders"
          subtitle="Switch this off to stop new orders coming in — during a rush, or when you're closed."
        />
        <div className="mt-5 space-y-4">
          <Checkbox
            name="acceptingOrders"
            label="Accepting orders right now"
            defaultChecked={settings.acceptingOrders}
          />
          <Field
            label="Notice shown to customers"
            hint="Optional. Appears on the site when set — e.g. “Busy tonight, delivery up to 60 min.”"
            error={e.orderNotice}
          >
            <Textarea
              name="orderNotice"
              rows={2}
              defaultValue={settings.orderNotice}
              placeholder="Leave empty for no notice"
            />
          </Field>
          <div>
            <Checkbox
              name="showLaunchBadge"
              label="Show the “New in Hoogkarspel” badge on the homepage"
              defaultChecked={settings.showLaunchBadge ?? true}
            />
            <p className="mt-1.5 text-xs text-muted">
              The small label above the homepage headline. Untick it once Kebabish is no longer new.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Payments"
          subtitle="How customers pay at checkout."
        />
        <div className="mt-5">
          <Field
            label="Mollie payment link (temporary)"
            hint="Leave empty for the normal automatic Mollie checkout. If you paste a payment link here, customers are sent to it to pay, and you confirm each payment in Mollie and press “Mark as paid” on the order. Remove it to switch back."
            error={e.paymentLinkUrl}
          >
            <Input
              name="paymentLinkUrl"
              type="url"
              defaultValue={settings.paymentLinkUrl ?? ""}
              placeholder="https://payment-links.mollie.com/payment/…"
              invalid={Boolean(e.paymentLinkUrl)}
            />
          </Field>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Opening hours"
            subtitle="Delivery only — there is no dine-in and no pickup."
          />
        </div>

        <p className="border-t border-hairline px-5 pt-3 text-xs text-muted sm:px-6">
          Each day can have its own slot length and orders-per-slot. Leave those two boxes
          empty to use the defaults in &ldquo;Delivery slots&rdquo; below.
        </p>

        <ul className="divide-y divide-hairline">
          {hours.map((entry, i) => (
            <li
              key={entry.day}
              className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6"
            >
              <input type="hidden" name="hourDay" value={entry.day} />
              <input
                type="hidden"
                name="hourClosed"
                value={String(entry.closed)}
              />

              <span className="w-24 shrink-0 text-sm font-medium text-heading">
                {DAY_NAMES[entry.day]}
              </span>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-body-text">
                <input
                  type="checkbox"
                  checked={entry.closed}
                  onChange={(ev) =>
                    setHours((prev) =>
                      prev.map((h, index) =>
                        index === i ? { ...h, closed: ev.target.checked } : h
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-hairline accent-ember-600"
                />
                Closed
              </label>

              <div
                className={`flex items-center gap-2 ${entry.closed ? "opacity-40" : ""}`}
              >
                <input
                  type="time"
                  name="hourOpens"
                  value={entry.opens}
                  // Not `disabled` — disabled fields are dropped from
                  // FormData on submit, which shifts every later day's
                  // values by one position once zipped back up server-side
                  // (see settings/actions.ts). The dimmed look above is
                  // opacity-only; the value still submits, it's just
                  // ignored server-side for a closed day.
                  readOnly={entry.closed}
                  tabIndex={entry.closed ? -1 : 0}
                  onChange={(ev) =>
                    setHours((prev) =>
                      prev.map((h, index) =>
                        index === i ? { ...h, opens: ev.target.value } : h
                      )
                    )
                  }
                  className="h-10 rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
                />
                <span className="text-sm text-muted">to</span>
                <input
                  type="time"
                  name="hourCloses"
                  value={entry.closes}
                  readOnly={entry.closed}
                  tabIndex={entry.closed ? -1 : 0}
                  onChange={(ev) =>
                    setHours((prev) =>
                      prev.map((h, index) =>
                        index === i ? { ...h, closes: ev.target.value } : h
                      )
                    )
                  }
                  className="h-10 rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
                />
              </div>

              {/* Optional per-day overrides. Not `disabled` when closed — a
                  disabled field drops out of FormData and would shift every
                  later day's value by one position (see actions.ts). */}
              <div className={`flex items-center gap-2 ${entry.closed ? "opacity-40" : ""}`}>
                <input
                  type="number"
                  name="hourSlotMinutes"
                  min={30}
                  max={120}
                  step={5}
                  defaultValue={entry.slotMinutes ?? ""}
                  readOnly={entry.closed}
                  tabIndex={entry.closed ? -1 : 0}
                  placeholder={String(defaultSlotMinutes)}
                  aria-label={`${DAY_NAMES[entry.day]} slot length in minutes`}
                  title="Slot length (min) — empty uses the default"
                  className="h-10 w-20 rounded-lg border border-hairline bg-panel px-2 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
                />
                <span className="text-xs text-muted">min</span>
                <input
                  type="number"
                  name="hourSlotCapacity"
                  min={1}
                  max={100}
                  step={1}
                  defaultValue={entry.slotCapacity ?? ""}
                  readOnly={entry.closed}
                  tabIndex={entry.closed ? -1 : 0}
                  placeholder={String(defaultSlotCapacity)}
                  aria-label={`${DAY_NAMES[entry.day]} orders per slot`}
                  title="Orders per slot — empty uses the default"
                  className="h-10 w-20 rounded-lg border border-hairline bg-panel px-2 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
                />
                <span className="text-xs text-muted">orders</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Delivery slots"
          subtitle="How the day is cut into delivery windows, and how many orders each can take."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field
            label="Slot length (minutes)"
            hint="30–120, steps of 5. A slot stops taking orders 15 minutes before it ends, so the kitchen has time."
            error={e.slotMinutes}
          >
            <Input
              name="slotMinutes"
              type="number"
              min="30"
              max="120"
              step="5"
              defaultValue={settings.slotMinutes ?? 45}
              onChange={(ev) => setDefaultSlotMinutes(Number(ev.target.value) || 45)}
              invalid={Boolean(e.slotMinutes)}
            />
          </Field>
          <Field
            label="Orders per slot"
            hint="The default for every slot. Change one day above, or one slot on the Delivery slots page."
            error={e.slotCapacity}
          >
            <Input
              name="slotCapacity"
              type="number"
              min="1"
              max="100"
              defaultValue={settings.slotCapacity ?? 10}
              onChange={(ev) => setDefaultSlotCapacity(Number(ev.target.value) || 10)}
              invalid={Boolean(e.slotCapacity)}
            />
          </Field>
          <Field
            label="Book ahead (days)"
            hint="How far ahead customers can pick a day, counting today. Up to 30."
            error={e.bookingWindowDays}
          >
            <Input
              name="bookingWindowDays"
              type="number"
              min="1"
              max="30"
              defaultValue={settings.bookingWindowDays ?? 7}
              invalid={Boolean(e.bookingWindowDays)}
            />
          </Field>
        </div>
        <p className="mt-4 rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
          Changing the slot length changes the slot <em>times</em> from then on. Orders already
          booked keep the time they were given, but they are counted against the old time, so
          the new slots start from zero for those days. Capacity limits you set on individual
          slots on the Delivery slots page belong to a specific start time and stop applying if
          that time no longer exists. Change this on a quiet day.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Delivery"
          subtitle="These drive the delivery-radius check and the checkout totals."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Delivery radius (km)" error={e.deliveryRadiusKm}>
            <Input
              name="deliveryRadiusKm"
              type="number"
              min="1"
              max="50"
              step="0.5"
              defaultValue={settings.deliveryRadiusKm}
              invalid={Boolean(e.deliveryRadiusKm)}
            />
          </Field>

          <Field label="Delivery fee (€)" error={e.deliveryFee}>
            <Input
              name="deliveryFee"
              type="number"
              min="0"
              step="0.05"
              defaultValue={settings.deliveryFee}
              invalid={Boolean(e.deliveryFee)}
            />
          </Field>

          <Field
            label="Free delivery over (€)"
            hint="Leave empty to always charge the fee."
            error={e.freeDeliveryOver}
          >
            <Input
              name="freeDeliveryOver"
              type="number"
              min="0"
              step="0.5"
              defaultValue={settings.freeDeliveryOver ?? ""}
            />
          </Field>

          <Field label="Minimum order (€)" error={e.minimumOrder}>
            <Input
              name="minimumOrder"
              type="number"
              min="0"
              step="0.5"
              defaultValue={settings.minimumOrder}
              invalid={Boolean(e.minimumOrder)}
            />
          </Field>

          <Field
            label="Average prep time (minutes)"
            hint="Shown as the estimated wait."
            error={e.averagePrepMinutes}
          >
            <Input
              name="averagePrepMinutes"
              type="number"
              min="5"
              max="180"
              defaultValue={settings.averagePrepMinutes}
              invalid={Boolean(e.averagePrepMinutes)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tax & invoices"
          subtitle="Used on the customer receipt, the printed invoice and the site footer. Ask your accountant for the right values — nothing is shown until you fill them in."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="VAT rate included in prices (%)"
            hint="Menu prices already include VAT. Leave empty to show no VAT amount."
            error={e.vatRatePercent}
          >
            <Input
              name="vatRatePercent"
              type="number"
              min="0"
              max="25"
              step="0.5"
              defaultValue={settings.vatRatePercent ?? ""}
              invalid={Boolean(e.vatRatePercent)}
            />
          </Field>
          <Field
            label="BTW-id"
            hint="Format NL123456789B01. Not the same as the KVK number."
            error={e.vatNumber}
          >
            <Input
              name="vatNumber"
              type="text"
              defaultValue={settings.vatNumber ?? ""}
              placeholder="NL123456789B01"
              invalid={Boolean(e.vatNumber)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Checkbox
            name="showLegalNameOnInvoice"
            label="Show the company name (Marfah Enterprise) on invoices"
            defaultChecked={settings.showLegalNameOnInvoice ?? false}
          />
          <p className="mt-1.5 text-xs text-muted">
            Invoices are issued as &ldquo;Kebabish&rdquo; with the KVK number and BTW-id. Ask your
            accountant whether they must also carry the registered company name — if so, tick this.
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
