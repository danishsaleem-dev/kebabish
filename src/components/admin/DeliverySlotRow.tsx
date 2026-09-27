"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateSlotConfigAction } from "@/app/admin/(dashboard)/settings/delivery-slots/actions";
import { useToast } from "@/components/admin/ui/Toast";
import type { AdminSlotRow } from "@/lib/delivery-slots-data";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/** Fires the given action's message as a toast whenever it changes. */
function useActionToast(state: FormState) {
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);
}

export default function DeliverySlotRow({
  weekday,
  row,
}: {
  weekday: number;
  row: AdminSlotRow;
}) {
  const [maxState, maxAction] = useActionState(updateSlotConfigAction, EMPTY);
  const [enabledState, enabledAction] = useActionState(updateSlotConfigAction, EMPTY);
  useActionToast(maxState);
  useActionToast(enabledState);

  const [maxOrders, setMaxOrders] = useState(row.maxOrders);
  const full = row.bookedCount >= maxOrders;

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-3.5 sm:px-6">
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold text-heading">
          {row.start}–{row.end}
        </p>
        {!row.enabled && (
          <p className="text-xs font-medium text-danger">Turned off</p>
        )}
      </div>

      <div className="shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            full ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
          }`}
        >
          {row.bookedCount}/{maxOrders} booked
        </span>
      </div>

      <form action={maxAction} className="flex items-center gap-2">
        <input type="hidden" name="weekday" value={weekday} />
        <input type="hidden" name="slotStart" value={row.start} />
        <input type="hidden" name="field" value="maxOrders" />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Capacity
          <input
            type="number"
            name="maxOrders"
            min={1}
            value={maxOrders}
            onChange={(e) => setMaxOrders(Number(e.target.value) || 1)}
            className="h-8 w-16 rounded-lg border border-hairline bg-panel px-2 text-sm text-heading focus:border-ember-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Save
        </button>
      </form>

      <form action={enabledAction} className="ml-auto shrink-0">
        <input type="hidden" name="weekday" value={weekday} />
        <input type="hidden" name="slotStart" value={row.start} />
        <input type="hidden" name="field" value="enabled" />
        <input type="hidden" name="enabled" value={String(!row.enabled)} />
        <button
          type="submit"
          role="switch"
          aria-checked={row.enabled}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            row.enabled ? "bg-ember-600" : "bg-hairline"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-panel shadow transition-transform ${
              row.enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </form>
    </li>
  );
}
