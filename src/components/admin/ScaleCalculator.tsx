"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { indexIngredients, scaleToPortions } from "@/lib/admin/recipe-math";
import { formatMoney, formatQuantity } from "@/lib/admin/units";
import { GROUP_LABELS, type IngredientGroup } from "@/lib/admin/ingredients";
import type { Recipe } from "@/lib/admin/recipes";
import type { StoredIngredient } from "@/lib/admin/store/types";

const PRESETS = [10, 20, 50, 100];

/**
 * "I want 20 plates of biryani — what do I need?"
 *
 * Scales the stored recipe to any portion count and shows the ingredient
 * breakdown grouped the way you'd walk a store room.
 */
export default function ScaleCalculator({
  recipe,
  ingredients,
  portionLabel,
}: {
  recipe: Recipe;
  ingredients: StoredIngredient[];
  portionLabel: string;
}) {
  const [portions, setPortions] = useState(20);

  const lookup = useMemo(() => indexIngredients(ingredients), [ingredients]);
  const scaled = useMemo(
    () => scaleToPortions(recipe, Math.max(1, portions), lookup),
    [recipe, portions, lookup]
  );

  const grouped = useMemo(() => {
    const groups = [...new Set(scaled.lines.map((l) => l.ingredient.group))];
    return groups.map((group) => ({
      group,
      lines: scaled.lines.filter((l) => l.ingredient.group === group),
    }));
  }, [scaled]);

  return (
    <div>
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-hairline">
          <button
            type="button"
            aria-label="Decrease portions"
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-l-xl text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min={1}
            value={portions}
            onChange={(e) => setPortions(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Number of portions"
            className="h-11 w-20 border-x border-hairline text-center font-display text-lg font-semibold text-heading focus:outline-none"
          />
          <button
            type="button"
            aria-label="Increase portions"
            onClick={() => setPortions((p) => p + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <Plus size={16} />
          </button>
        </div>

        <span className="text-sm text-muted">{portionLabel}</span>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPortions(preset)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                portions === preset
                  ? "border-ember-600 bg-ember-600 text-cream-50"
                  : "border-hairline text-body-text hover:bg-canvas"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Scale factor"
          value={`${scaled.factor.toFixed(2)}×`}
          hint={`recipe makes ${recipe.batchPortions}`}
        />
        <Metric
          label="Total plated"
          value={formatQuantity(scaled.totalPlatedG, "mass")}
          hint={`${recipe.portionWeightG} g each`}
        />
        <Metric
          label="Ingredient cost"
          value={formatMoney(scaled.totalCost)}
          hint="placeholder pricing"
        />
        <Metric
          label="Cost / portion"
          value={formatMoney(scaled.totalCost / Math.max(1, portions))}
          hint="placeholder pricing"
        />
      </div>

      {/* breakdown */}
      <div className="mt-6 space-y-5">
        {grouped.map(({ group, lines }) => (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              {GROUP_LABELS[group as IngredientGroup]}
            </p>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {lines.map((line) => (
                <li
                  key={line.ingredient.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-heading">
                      {line.ingredient.name}
                      {line.line.optional && (
                        <span className="ml-2 rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
                          optional
                        </span>
                      )}
                    </p>
                    {line.line.note && (
                      <p className="truncate text-xs text-muted">{line.line.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm font-semibold text-heading">
                      {line.display}
                    </p>
                    <p className="text-xs text-faint">{formatMoney(line.cost)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold text-heading">
        {value}
      </p>
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  );
}
