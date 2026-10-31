"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "@/components/admin/ui/Form";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredSupply, SupplyKind } from "@/lib/admin/store/types";
import { SUPPLY_KIND_LABELS, SUPPLY_UNITS } from "@/lib/supplies";

const EMPTY: FormState = { ok: false };

export default function SupplyForm({
  action,
  supply,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  supply?: StoredSupply;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  const [unit, setUnit] = useState<string>(supply?.unit ?? "pcs");
  const [kind, setKind] = useState<SupplyKind>(supply?.kind ?? "per-order");
  const [quantity, setQuantity] = useState(String(supply?.baseQuantity ?? ""));
  const [price, setPrice] = useState(String(supply?.basePrice ?? ""));

  const q = Number(quantity);
  const p = Number(price);
  const derived =
    quantity.trim() !== "" && price.trim() !== "" && q > 0 && p >= 0
      ? Math.round((p / q) * 10000) / 10000
      : null;

  return (
    <form action={formAction} className="space-y-5">
      {supply && <input type="hidden" name="id" value={supply.id} />}
      <FormError message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={e.name} className="sm:col-span-2">
          <Input
            name="name"
            defaultValue={supply?.name}
            placeholder="Paper bags"
            invalid={Boolean(e.name)}
            required
          />
        </Field>

        <Field
          label="What kind of cost is it?"
          hint={
            kind === "per-order"
              ? "Each order uses some (a box, a bag, a fork). Its cost is added to every order in Reports."
              : "Used up over time (gloves, cling film, bin liners). Counted by what you spend on it each period."
          }
          error={e.kind}
          className="sm:col-span-2"
        >
          <Select
            name="kind"
            value={kind}
            onChange={(ev) => setKind(ev.target.value as SupplyKind)}
            invalid={Boolean(e.kind)}
          >
            {(Object.keys(SUPPLY_KIND_LABELS) as SupplyKind[]).map((k) => (
              <option key={k} value={k}>
                {SUPPLY_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Base unit" hint="The unit the quantity below is counted in." error={e.unit}>
          <Select name="unit" value={unit} onChange={(ev) => setUnit(ev.target.value)} invalid={Boolean(e.unit)}>
            {SUPPLY_UNITS.map((u) => (
              <option key={u} value={u}>
                {u === "m" ? "m (metres)" : u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Supplier" hint="Optional." error={e.supplier}>
          <Input name="supplier" defaultValue={supply?.supplier ?? ""} placeholder="Baas Verpakkingen" />
        </Field>

        <Field
          label={`Base quantity (${unit})`}
          hint="How much you get for the base price, e.g. 50 for a pack of 50. Leave empty until you know it."
          error={e.baseQuantity}
        >
          <Input
            name="baseQuantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
            placeholder="50"
            invalid={Boolean(e.baseQuantity)}
          />
        </Field>

        <Field label="Base price (€)" hint="What that whole quantity costs." error={e.basePrice}>
          <Input
            name="basePrice"
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(ev) => setPrice(ev.target.value)}
            placeholder="5.95"
            invalid={Boolean(e.basePrice)}
          />
        </Field>

        <Field
          label={`Cost per ${unit}`}
          hint="Worked out for you (base price ÷ base quantity)."
          className={kind === "per-order" ? "" : "sm:col-span-2"}
        >
          <div className="rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 text-sm font-semibold text-heading">
            {derived !== null ? `€ ${derived.toFixed(4)} per ${unit}` : "—"}
          </div>
        </Field>

        {kind === "per-order" && (
          <Field
            label={`Used per order (${unit})`}
            hint="How many one order uses, e.g. 1 box. Until this is filled in, this supply isn't counted in the packaging cost."
            error={e.perOrderQuantity}
          >
            <Input
              name="perOrderQuantity"
              type="number"
              step="any"
              min="0"
              defaultValue={supply?.perOrderQuantity ?? ""}
              placeholder="1"
              invalid={Boolean(e.perOrderQuantity)}
            />
          </Field>
        )}

        <Field label="Note" hint="Optional." error={e.note} className="sm:col-span-2">
          <Textarea name="note" rows={2} defaultValue={supply?.note ?? ""} maxLength={200} />
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>{supply ? "Save changes" : "Add supply"}</SubmitButton>
        <Link
          href="/admin/menu/supplies"
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
