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
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Opening hours"
            subtitle="Delivery and takeaway only — there is no dine-in."
          />
        </div>

        <ul className="divide-y divide-hairline border-t border-hairline">
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
            </li>
          ))}
        </ul>
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

      <div className="flex items-center gap-3">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
