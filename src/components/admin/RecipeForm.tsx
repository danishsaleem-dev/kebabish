"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/admin/ui/Form";
import {
  analyseRecipe,
  indexIngredients,
} from "@/lib/admin/recipe-math";
import { formatMoney, formatQuantity, type Unit } from "@/lib/admin/units";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type {
  StoredAllergen,
  StoredIngredient,
  StoredRecipe,
} from "@/lib/admin/store/types";

const EMPTY: FormState = { ok: false };
const UNITS: Unit[] = ["g", "kg", "ml", "l", "pcs"];

interface DraftLine {
  key: number;
  ingredientId: string;
  quantity: string;
  unit: Unit;
  note: string;
  optional: boolean;
}

let nextKey = 0;
const newLine = (): DraftLine => ({
  key: nextKey++,
  ingredientId: "",
  quantity: "",
  unit: "g",
  note: "",
  optional: false,
});

export default function RecipeForm({
  action,
  slug,
  itemName,
  sellPrice,
  ingredients,
  allergens,
  recipe,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  slug: string;
  itemName: string;
  sellPrice: number | null;
  ingredients: StoredIngredient[];
  allergens: StoredAllergen[];
  recipe?: StoredRecipe;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  const [lines, setLines] = useState<DraftLine[]>(() =>
    recipe && recipe.lines.length > 0
      ? recipe.lines.map((l) => ({
          key: nextKey++,
          ingredientId: l.ingredientId,
          quantity: String(l.quantity),
          unit: l.unit,
          note: l.note ?? "",
          optional: Boolean(l.optional),
        }))
      : [newLine()]
  );

  const [portionWeightG, setPortionWeightG] = useState(
    String(recipe?.portionWeightG ?? 500)
  );
  const [batchPortions, setBatchPortions] = useState(
    String(recipe?.batchPortions ?? 4)
  );

  const lookup = useMemo(() => indexIngredients(ingredients), [ingredients]);

  // Live preview — recomputes as you type, so mistakes surface immediately
  // rather than after saving.
  const preview = useMemo(() => {
    const parsedLines = lines
      .filter((l) => l.ingredientId && Number(l.quantity) > 0)
      .map((l) => ({
        ingredientId: l.ingredientId,
        quantity: Number(l.quantity),
        unit: l.unit,
        optional: l.optional,
      }));

    if (parsedLines.length === 0) return null;

    return analyseRecipe(
      {
        menuItemSlug: slug,
        portionWeightG: Number(portionWeightG) || 0,
        batchPortions: Number(batchPortions) || 1,
        prepMinutes: 0,
        cookMinutes: 0,
        lines: parsedLines,
        steps: [],
      },
      lookup,
      sellPrice
    );
  }, [lines, portionWeightG, batchPortions, lookup, slug, sellPrice]);

  const update = (key: number, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="menuItemSlug" value={slug} />
      <FormError message={state.message} />

      {/* yield */}
      <div className="grid gap-5 sm:grid-cols-4">
        <Field
          label="Portion weight (g)"
          hint="Plated weight of one serving."
          error={e.portionWeightG}
        >
          <Input
            name="portionWeightG"
            type="number"
            min="1"
            value={portionWeightG}
            onChange={(ev) => setPortionWeightG(ev.target.value)}
            invalid={Boolean(e.portionWeightG)}
            required
          />
        </Field>

        <Field
          label="Batch makes"
          hint="Portions from the quantities below."
          error={e.batchPortions}
        >
          <Input
            name="batchPortions"
            type="number"
            min="1"
            value={batchPortions}
            onChange={(ev) => setBatchPortions(ev.target.value)}
            invalid={Boolean(e.batchPortions)}
            required
          />
        </Field>

        <Field label="Prep (min)" error={e.prepMinutes}>
          <Input
            name="prepMinutes"
            type="number"
            min="0"
            defaultValue={recipe?.prepMinutes ?? 0}
          />
        </Field>

        <Field label="Cook (min)" error={e.cookMinutes}>
          <Input
            name="cookMinutes"
            type="number"
            min="0"
            defaultValue={recipe?.cookMinutes ?? 0}
          />
        </Field>
      </div>

      {/* ingredient lines */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-heading">Ingredients</h3>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
          >
            <Plus size={15} />
            Add line
          </button>
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid grid-cols-12 items-start gap-2 rounded-xl border border-hairline p-2"
            >
              <GripVertical
                size={16}
                className="col-span-1 mt-3 hidden justify-self-center text-faint sm:block"
              />

              <div className="col-span-12 sm:col-span-4">
                <Select
                  name="lineIngredientId"
                  value={line.ingredientId}
                  onChange={(ev) =>
                    update(line.key, { ingredientId: ev.target.value })
                  }
                >
                  <option value="">Choose ingredient…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="col-span-4 sm:col-span-2">
                <Input
                  name="lineQuantity"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(ev) =>
                    update(line.key, { quantity: ev.target.value })
                  }
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <Select
                  name="lineUnit"
                  value={line.unit}
                  onChange={(ev) =>
                    update(line.key, { unit: ev.target.value as Unit })
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="col-span-5 sm:col-span-3">
                <Input
                  name="lineNote"
                  placeholder="Note (optional)"
                  value={line.note}
                  onChange={(ev) => update(line.key, { note: ev.target.value })}
                />
              </div>

              {/* Hidden field keeps the parallel arrays aligned per line. */}
              <input
                type="hidden"
                name="lineOptional"
                value={String(line.optional)}
              />

              <div className="col-span-12 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted sm:hidden">
                  <input
                    type="checkbox"
                    checked={line.optional}
                    onChange={(ev) =>
                      update(line.key, { optional: ev.target.checked })
                    }
                    className="h-4 w-4 rounded border-hairline accent-ember-600"
                  />
                  Optional
                </label>
                <input
                  type="checkbox"
                  aria-label="Optional ingredient"
                  title="Optional"
                  checked={line.optional}
                  onChange={(ev) =>
                    update(line.key, { optional: ev.target.checked })
                  }
                  className="mt-3 hidden h-4 w-4 rounded border-hairline accent-ember-600 sm:block"
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length === 1
                        ? [newLine()]
                        : prev.filter((l) => l.key !== line.key)
                    )
                  }
                  className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* live preview */}
      {preview && (
        <div className="rounded-xl bg-canvas p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Live preview
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Preview
              label="Raw input"
              value={formatQuantity(preview.rawInputG, "mass")}
            />
            <Preview
              label="Yield"
              value={`${Math.round(preview.yieldFactor * 100)}%`}
            />
            <Preview
              label="Cost / batch"
              value={formatMoney(preview.costPerBatch)}
            />
            <Preview
              label="Cost / portion"
              value={formatMoney(preview.costPerPortion)}
            />
          </div>
          {preview.allergens.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              <span className="font-semibold">Allergens:</span>{" "}
              {preview.allergens
                .map((a) => allergens.find((x) => x.id === a)?.label ?? a)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      {/* method */}
      <Field
        label="Method"
        hint="One step per line."
        error={e.steps}
      >
        <Textarea
          name="steps"
          rows={6}
          defaultValue={recipe?.steps.join("\n")}
          placeholder={"Fry the onion until golden.\nAdd the chicken and spices.\nLayer and steam on dum."}
        />
      </Field>

      <Field label="Notes" hint="Optional." error={e.notes}>
        <Textarea name="notes" rows={2} defaultValue={recipe?.notes ?? ""} />
      </Field>

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>
          {recipe ? "Save recipe" : `Create recipe for ${itemName}`}
        </SubmitButton>
        <Link
          href={`/admin/menu/recipes/${slug}`}
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-base font-semibold text-heading">{value}</p>
    </div>
  );
}
