"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { Input, SubmitButton } from "@/components/admin/ui/Form";
import {
  createAllergenAction,
  deleteAllergenAction,
  updateAllergenAction,
  type FormState,
} from "@/app/admin/(dashboard)/menu/actions";
import type { StoredAllergen } from "@/lib/admin/store/types";
import { useToast } from "@/components/admin/ui/Toast";

const EMPTY: FormState = { ok: false };

export default function AllergenManager({
  allergens,
  usage,
}: {
  allergens: StoredAllergen[];
  usage: Record<string, number>;
}) {
  const [createState, createAction] = useActionState(
    createAllergenAction,
    EMPTY
  );
  const [editing, setEditing] = useState<string | null>(null);
  const { toast } = useToast();

  const lastRef = useRef<FormState | null>(null);
  useEffect(() => {
    if (!createState.message || lastRef.current === createState) return;
    lastRef.current = createState;
    toast(createState.message, createState.ok ? "success" : "error");
  }, [createState, toast]);

  const statutory = allergens.filter((a) => a.statutory);
  const custom = allergens.filter((a) => !a.statutory);

  return (
    <>
      <Card>
        <form action={createAction} className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-heading">
              Add your own allergen
            </span>
            <Input
              name="label"
              placeholder="e.g. Coconut"
              invalid={Boolean(createState.errors?.label)}
              required
            />
          </label>
          <SubmitButton>
            <Plus size={15} />
            Add
          </SubmitButton>
        </form>

        {createState.errors?.label && (
          <p className="mt-2 text-xs font-medium text-danger">
            {createState.errors.label}
          </p>
        )}

      </Card>

      {custom.length > 0 && (
        <Card padded={false}>
          <p className="px-5 py-4 font-display text-base font-semibold text-heading sm:px-6">
            Your allergens
          </p>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {custom.map((allergen) => (
              <Row
                key={allergen.id}
                allergen={allergen}
                count={usage[allergen.id] ?? 0}
                editing={editing === allergen.id}
                onEdit={() => setEditing(allergen.id)}
                onCancel={() => setEditing(null)}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card padded={false}>
        <div className="px-5 py-4 sm:px-6">
          <p className="font-display text-base font-semibold text-heading">
            EU required
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Renameable, but these must stay on the list.
          </p>
        </div>
        <ul className="divide-y divide-hairline border-t border-hairline">
          {statutory.map((allergen) => (
            <Row
              key={allergen.id}
              allergen={allergen}
              count={usage[allergen.id] ?? 0}
              editing={editing === allergen.id}
              onEdit={() => setEditing(allergen.id)}
              onCancel={() => setEditing(null)}
            />
          ))}
        </ul>
      </Card>
    </>
  );
}

function Row({
  allergen,
  count,
  editing,
  onEdit,
  onCancel,
}: {
  allergen: StoredAllergen;
  count: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [, updateAction] = useActionState(updateAllergenAction, EMPTY);

  return (
    <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
      {editing ? (
        <form action={updateAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={allergen.id} />
          <Input
            name="label"
            defaultValue={allergen.label}
            autoFocus
            className="max-w-xs"
          />
          <button
            type="submit"
            onClick={onCancel}
            aria-label="Save"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember-600 text-cream-50 hover:bg-ember-500"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted hover:bg-canvas"
          >
            <X size={15} />
          </button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm font-medium text-heading">
              {allergen.label}
              {allergen.statutory && (
                <span className="shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
                  EU required
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              {count === 0
                ? "Not tagged on any ingredient"
                : `Tagged on ${count} ingredient${count === 1 ? "" : "s"}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onEdit}
            aria-label={`Rename ${allergen.label}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <Pencil size={15} />
          </button>

          {!allergen.statutory && (
            <DeleteButton
              action={deleteAllergenAction}
              hiddenField={{ name: "id", value: allergen.id }}
              label={`Delete ${allergen.label}`}
              compact
            />
          )}
        </>
      )}
    </li>
  );
}
