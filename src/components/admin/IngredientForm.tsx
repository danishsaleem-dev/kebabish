"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
} from "@/components/admin/ui/Form";
import { GROUP_LABELS, type IngredientGroup } from "@/lib/admin/ingredients";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredAllergen, StoredIngredient } from "@/lib/admin/store/types";

const EMPTY: FormState = { ok: false };
const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;

export default function IngredientForm({
  action,
  ingredient,
  allergens,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  ingredient?: StoredIngredient;
  allergens: StoredAllergen[];
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  const [unit, setUnit] = useState<string>(ingredient?.unit ?? "kg");
  const [quantity, setQuantity] = useState(String(ingredient?.stockQuantity ?? ""));
  const [total, setTotal] = useState(String(ingredient?.stockTotalCost ?? ""));
  const [contains, setContains] = useState<string[]>(ingredient?.allergens ?? []);
  // Same rule as the server: base price ÷ base quantity, once both are filled in.
  const q = Number(quantity);
  const t = Number(total);
  const derived =
    quantity.trim() !== "" && total.trim() !== "" && q > 0 && t >= 0
      ? Math.round((t / q) * 10000) / 10000
      : null;

  return (
    <form action={formAction} className="space-y-5">
      {ingredient && <input type="hidden" name="id" value={ingredient.id} />}
      <FormError message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ingredient name" error={e.name} className="sm:col-span-2">
          <Input
            name="name"
            defaultValue={ingredient?.name}
            placeholder="Basmati rice"
            invalid={Boolean(e.name)}
            required
          />
        </Field>

        <Field label="Group" error={e.group}>
          <Select
            name="group"
            defaultValue={ingredient?.group ?? "dry-goods"}
            invalid={Boolean(e.group)}
          >
            {(Object.keys(GROUP_LABELS) as IngredientGroup[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Base unit"
          hint="The unit the quantity below is counted in."
          error={e.unit}
        >
          <Select
            name="unit"
            value={unit}
            onChange={(ev) => setUnit(ev.target.value)}
            invalid={Boolean(e.unit)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={`Base quantity (${unit})`}
          hint={`How much you get for the base price, e.g. 10 for a 10 ${unit} pack.`}
          error={e.stockQuantity}
        >
          <Input
            name="stockQuantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
            placeholder="10"
            invalid={Boolean(e.stockQuantity)}
            required
          />
        </Field>

        <Field
          label="Base price (€)"
          hint="What that whole quantity costs."
          error={e.stockTotalCost}
        >
          <Input
            name="stockTotalCost"
            type="number"
            step="any"
            min="0"
            value={total}
            onChange={(ev) => setTotal(ev.target.value)}
            placeholder="28.50"
            invalid={Boolean(e.stockTotalCost)}
            required
          />
        </Field>

        <Field
          label={`Cost per ${unit}`}
          hint="Worked out for you (base price ÷ base quantity). It drives every food-cost and margin figure."
        >
          <div className="rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 text-sm font-semibold text-heading">
            {derived !== null ? `€ ${derived.toFixed(4)} per ${unit}` : "—"}
          </div>
        </Field>

        <Field label="Supplier" hint="Optional." error={e.supplier}>
          <Input
            name="supplier"
            defaultValue={ingredient?.supplier ?? ""}
            placeholder="Sligro"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-heading">
          Contains (Bevat)
        </legend>
        <p className="mb-3 text-xs text-muted">
          Confirmed ingredients. These roll up automatically to every dish using this ingredient.{" "}
          <Link
            href="/admin/menu/allergens"
            className="font-semibold text-ember-600 hover:underline"
          >
            Manage the list
          </Link>{" "}
          to add your own.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {allergens.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 py-2"
            >
              <input
                type="checkbox"
                name="allergens"
                value={a.id}
                checked={contains.includes(a.id)}
                onChange={(ev) =>
                  setContains((cur) =>
                    ev.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)
                  )
                }
                className="h-4 w-4 rounded border-hairline accent-ember-600"
              />
              <span className="text-sm text-body-text">{a.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-heading">
          May contain (Kan bevatten)
        </legend>
        <p className="mb-3 text-xs text-muted">
          Cross-contact warnings from the label. These are shown to customers
          separately and are never treated as confirmed ingredients. An allergen
          already ticked above can&rsquo;t also be a &ldquo;may contain&rdquo;.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {allergens.map((a) => {
            const confirmed = contains.includes(a.id);
            return (
              <label
                key={a.id}
                className={`flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 ${
                  confirmed ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  name="mayContain"
                  value={a.id}
                  disabled={confirmed}
                  defaultChecked={ingredient?.mayContain?.includes(a.id)}
                  className="h-4 w-4 rounded border-hairline accent-ember-600"
                />
                <span className="text-sm text-body-text">{a.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>
          {ingredient ? "Save changes" : "Create ingredient"}
        </SubmitButton>
        <Link
          href="/admin/menu/ingredients"
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
