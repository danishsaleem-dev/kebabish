"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/admin/ui/Form";
import { quickUpdateItemAction } from "@/app/admin/(dashboard)/menu/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredCategory, StoredItem } from "@/lib/admin/store/types";

/** The switches the table can flip without opening the dish. Order is the one on screen. */
const STATUS: { name: string; label: string; of: (item: StoredItem) => boolean }[] = [
  { name: "visible", label: "Show on website", of: (i) => i.visible },
  { name: "soldOut", label: "Sold out", of: (i) => i.soldOut },
  { name: "isNew", label: "New badge", of: (i) => Boolean(i.isNew) },
  { name: "chefsPick", label: "Chef's pick", of: (i) => Boolean(i.chefsPick) },
  { name: "featured", label: "Featured", of: (i) => Boolean(i.featured) },
  { name: "vegetarian", label: "Vegetarian", of: (i) => i.vegetarian },
];

/**
 * WooCommerce's "Quick edit": the row folds open into a small form for the things you change
 * often — status, category, name, price, tags — and saves without leaving the list.
 *
 * It only ever sends those fields, and `updateItem` assigns only the keys it is given, so the
 * dish keeps its photos, recipe, extras, allergens and description. Anything that is a real
 * decision rather than a switch still lives in the full editor.
 */
export default function QuickEditRow({
  item,
  categories,
  columns,
  onDone,
}: {
  item: StoredItem;
  categories: StoredCategory[];
  /** How many columns the table has, so the form spans the whole row. */
  columns: number;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await quickUpdateItemAction(prev, formData);
      // Closed from inside the action, not an effect: the row should stay open with its
      // messages when something is wrong, and only fold away once the save went through.
      if (result.ok) onDone();
      return result;
    },
    { ok: false } as FormState
  );

  const e = state.errors ?? {};

  return (
    <tr className="bg-canvas/70">
      <td colSpan={columns} className="px-5 py-5 sm:px-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="slug" value={item.slug} />

          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-heading">
              Quick edit — <span className="text-ember-700">{item.name}</span>
            </p>
            <button
              type="button"
              onClick={onDone}
              aria-label="Close quick edit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-panel hover:text-heading"
            >
              <X size={16} />
            </button>
          </div>

          <FormError message={!state.ok ? state.message : undefined} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name (Dutch)" error={e.name}>
              <Input name="name" defaultValue={item.name} invalid={Boolean(e.name)} />
            </Field>

            <Field label="Category" error={e.categoryId}>
              <Select name="categoryId" defaultValue={item.categoryId} invalid={Boolean(e.categoryId)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Price (€)" error={e.price} hint='Empty = "price on request".'>
              <Input
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.price ?? ""}
                invalid={Boolean(e.price)}
              />
            </Field>

            <Field label="Tags" error={e.tags} hint="Comma separated. Admin-side only.">
              <Input name="tags" defaultValue={(item.tags ?? []).join(", ")} placeholder="Populair, Zomer" />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-heading">Status</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              {STATUS.map(({ name, label, of }) => (
                <label key={name} className="flex cursor-pointer items-center gap-2 text-sm text-body-text">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={of(item)}
                    className="h-4 w-4 rounded border-hairline accent-ember-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            {e.featured && <p className="mt-2 text-xs font-medium text-danger">{e.featured}</p>}
          </fieldset>

          <div className="flex items-center gap-3">
            <SubmitButton>Save</SubmitButton>
            <button
              type="button"
              onClick={onDone}
              className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-panel"
            >
              Cancel
            </button>
            <a
              href={`/admin/menu/items/${item.slug}/edit`}
              className="text-sm font-semibold text-ember-700 hover:underline"
            >
              Open full editor
            </a>
          </div>
        </form>
      </td>
    </tr>
  );
}
