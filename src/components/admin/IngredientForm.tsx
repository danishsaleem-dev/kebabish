"use client";

import { useActionState } from "react";
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
          label="Purchased per"
          hint="The unit your supplier prices it in."
          error={e.unit}
        >
          <Select
            name="unit"
            defaultValue={ingredient?.unit ?? "kg"}
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
          label="Cost per unit (€)"
          hint="Drives every food-cost and margin figure."
          error={e.costPerUnit}
        >
          <Input
            name="costPerUnit"
            type="number"
            step="0.01"
            min="0"
            defaultValue={ingredient?.costPerUnit ?? ""}
            placeholder="2.20"
            invalid={Boolean(e.costPerUnit)}
            required
          />
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
          Allergens
        </legend>
        <p className="mb-3 text-xs text-muted">
          These roll up automatically to every dish using this ingredient.{" "}
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
                defaultChecked={ingredient?.allergens.includes(a.id)}
                className="h-4 w-4 rounded border-hairline accent-ember-600"
              />
              <span className="text-sm text-body-text">{a.label}</span>
            </label>
          ))}
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
