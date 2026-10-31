"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function PurchaseForm({
  action,
  supplies,
  today,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  supplies: { id: string; name: string; unit: string }[];
  /** Today's Amsterdam date, from the server, so the first paint matches. */
  today: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};
  const { toast } = useToast();
  const [supplyId, setSupplyId] = useState("");
  // A fresh key remounts the fields after a successful save, which clears them.
  const [round, setRound] = useState(0);

  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.ok || handled.current === state) return;
    handled.current = state;
    toast(state.message ?? "Purchase logged.", "success");
    // Clearing the form after a save is exactly what the key is for.
    setRound((r) => r + 1);
  }, [state, toast]);

  const unit = supplies.find((s) => s.id === supplyId)?.unit;

  return (
    <form action={formAction} key={round} className="space-y-5">
      <FormError message={state.ok ? undefined : state.message} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="What was bought" error={e.supplyId} className="lg:col-span-2">
          <Select
            name="supplyId"
            value={supplyId}
            onChange={(ev) => setSupplyId(ev.target.value)}
            invalid={Boolean(e.supplyId)}
            required
          >
            <option value="">Choose a supply…</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Day bought" error={e.purchasedOn}>
          <Input name="purchasedOn" type="date" defaultValue={today} max={today} invalid={Boolean(e.purchasedOn)} required />
        </Field>
        <Field label={unit ? `How many (${unit})` : "How many"} error={e.quantity}>
          <Input name="quantity" type="number" step="any" min="0" placeholder="50" invalid={Boolean(e.quantity)} required />
        </Field>
        <Field label="Total paid (€)" error={e.amount}>
          <Input name="amount" type="number" step="0.01" min="0" placeholder="5.95" invalid={Boolean(e.amount)} required />
        </Field>
        <Field label="Note" hint="Optional." error={e.note} className="sm:col-span-2 lg:col-span-3">
          <Input name="note" maxLength={200} placeholder="Invoice number, shop…" />
        </Field>
      </div>
      <SubmitButton>Log purchase</SubmitButton>
    </form>
  );
}
