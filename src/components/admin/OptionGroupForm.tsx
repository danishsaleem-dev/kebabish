"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredOptionGroup } from "@/lib/admin/store/types";

type Draft = { label: string; price: string };

/**
 * Create/edit one group of extras.
 *
 * The option rows are held in React state and submitted as a single JSON
 * field rather than parallel `optionLabel[]`/`optionPrice[]` inputs —
 * parallel arrays have to be zipped by position server-side, and anything
 * that stops one field submitting shifts every later row onto the wrong
 * record. That exact bug bit the opening-hours form.
 */
export default function OptionGroupForm({
  group,
  action,
  submitLabel,
}: {
  group?: StoredOptionGroup;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });

  const [options, setOptions] = useState<Draft[]>(
    group?.options.length
      ? group.options.map((o) => ({ label: o.label, price: String(o.price) }))
      : [{ label: "", price: "0" }]
  );

  const update = (i: number, patch: Partial<Draft>) =>
    setOptions((prev) =>
      prev.map((o, index) => (index === i ? { ...o, ...patch } : o))
    );

  const serialised = JSON.stringify(
    options
      .filter((o) => o.label.trim() !== "")
      .map((o) => ({ label: o.label.trim(), price: Number(o.price || 0) }))
  );

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      {group && <input type="hidden" name="id" value={group.id} />}
      <input type="hidden" name="options" value={serialised} />

      <Card>
        <CardHeader
          title={group ? `Edit “${group.label}”` : "New extras group"}
          subtitle="A reusable set of extras you can attach to any dish — sauces, drinks, toppings."
        />

        <div className="mt-4 space-y-4">
          <Field label="Group name" error={state.errors?.label}>
            <input
              name="label"
              defaultValue={group?.label}
              placeholder="Sauces"
              className="h-10 w-full rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum choices"
              hint="0 means the customer can skip this."
              error={state.errors?.minChoices}
            >
              <input
                type="number"
                name="minChoices"
                min={0}
                max={20}
                defaultValue={group?.minChoices ?? 0}
                className="h-10 w-full rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
              />
            </Field>

            <Field
              label="Maximum choices"
              hint="1 shows radio buttons, more shows checkboxes."
              error={state.errors?.maxChoices}
            >
              <input
                type="number"
                name="maxChoices"
                min={1}
                max={20}
                defaultValue={group?.maxChoices ?? 1}
                className="h-10 w-full rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardHeader
            title="Options"
            subtitle="Leave a price at 0 for a free choice."
          />
          <button
            type="button"
            onClick={() =>
              setOptions((prev) => [...prev, { label: "", price: "0" }])
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-heading transition-colors hover:border-ember-500 hover:text-ember-600"
          >
            <Plus size={14} />
            Add option
          </button>
        </div>

        {state.errors?.options && (
          <p className="mt-3 text-sm text-danger">{state.errors.options}</p>
        )}

        <ul className="mt-4 space-y-2">
          {options.map((option, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={option.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Garlic sauce"
                aria-label={`Option ${i + 1} name`}
                className="h-10 flex-1 rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted">€</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={option.price}
                  onChange={(e) => update(i, { price: e.target.value })}
                  aria-label={`Option ${i + 1} surcharge`}
                  className="h-10 w-24 rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setOptions((prev) => prev.filter((_, index) => index !== i))
                }
                aria-label={`Remove option ${i + 1}`}
                disabled={options.length === 1}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:text-danger disabled:opacity-30 disabled:hover:text-faint"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {state.message && !state.ok && (
        <p className="text-sm text-danger">{state.message}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ember-500 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-heading">
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
