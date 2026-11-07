"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { Field, FormError, Input, Select, SubmitButton } from "@/components/admin/ui/Form";
import { bulkUpdateItemsAction } from "@/app/admin/(dashboard)/menu/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredCategory } from "@/lib/admin/store/types";

const STATUS: { name: string; label: string }[] = [
  { name: "visible", label: "Show on website" },
  { name: "soldOut", label: "Sold out" },
  { name: "isNew", label: "New badge" },
  { name: "chefsPick", label: "Chef's pick" },
  { name: "featured", label: "Featured" },
  { name: "vegetarian", label: "Vegetarian" },
];

/**
 * WooCommerce's "Bulk edit": change the same thing on everything that is ticked.
 *
 * **Every field means "leave it alone" until you say otherwise.** The statuses are three-way
 * selects rather than checkboxes for exactly that reason — an unticked checkbox and "don't
 * touch this" look identical when a form is submitted, so checkboxes here would quietly clear
 * a flag on every dish in the selection. The server applies the same rule.
 *
 * Deliberately not here: price (bulk money changes are the easiest way to do real damage, and
 * Danish didn't ask for it) and delete (there is no undo — delete from the row instead).
 */
export default function BulkEditPanel({
  slugs,
  categories,
  onDone,
}: {
  /** The ticked dishes. */
  slugs: string[];
  categories: StoredCategory[];
  /** Called once a save goes through, to clear the selection and close the panel. */
  onDone: () => void;
}) {
  const [tagMode, setTagMode] = useState("");
  const [state, formAction] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await bulkUpdateItemsAction(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    { ok: false } as FormState
  );

  const e = state.errors ?? {};

  return (
    <form action={formAction} className="border-t border-hairline bg-canvas/70 px-5 py-5 sm:px-6">
      {slugs.map((slug) => (
        <input key={slug} type="hidden" name="slugs" value={slug} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-heading">
          Edit {slugs.length} {slugs.length === 1 ? "dish" : "dishes"} together
        </p>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close bulk edit"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-panel hover:text-heading"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-1 text-xs text-muted">
        Everything is left as it is unless you change it below.
      </p>

      <div className="mt-4">
        <FormError message={!state.ok ? state.message : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Field label="Category" error={e.categoryId}>
          <Select name="categoryId" defaultValue="" invalid={Boolean(e.categoryId)}>
            <option value="">— Leave as it is —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                Move to {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-heading">Status</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {STATUS.map(({ name, label }) => (
              <label key={name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-sm text-body-text">{label}</span>
                <Select name={name} defaultValue="" className="py-1.5">
                  <option value="">No change</option>
                  <option value="on">Yes</option>
                  <option value="off">No</option>
                </Select>
              </label>
            ))}
          </div>
          {e.featured && <p className="mt-2 text-xs font-medium text-danger">{e.featured}</p>}
        </fieldset>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Field label="Tags">
          <Select name="tagMode" value={tagMode} onChange={(ev) => setTagMode(ev.target.value)}>
            <option value="">— Leave as they are —</option>
            <option value="add">Add these tags</option>
            <option value="remove">Remove these tags</option>
            <option value="replace">Replace with these tags</option>
          </Select>
        </Field>
        <Field
          label="Which tags"
          hint={
            tagMode === "replace"
              ? "Comma separated. Leave empty to clear every tag on the selected dishes."
              : "Comma separated."
          }
        >
          <Input name="tags" placeholder="Populair, Zomer" disabled={tagMode === ""} />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton>
          <Check size={15} />
          Apply to {slugs.length}
        </SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-panel"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
