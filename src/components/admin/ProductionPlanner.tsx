"use client";

import { useMemo, useState } from "react";
import { ChefHat, ShoppingBasket } from "lucide-react";
import { buildProductionPlan, indexIngredients } from "@/lib/admin/recipe-math";
import { formatMoney } from "@/lib/admin/units";
import { GROUP_LABELS } from "@/lib/admin/ingredients";
import Card from "@/components/admin/ui/Card";
import type { StoredIngredient, StoredRecipe } from "@/lib/admin/store/types";

export interface PlannerDish {
  slug: string;
  name: string;
  portionWeightG: number;
}

/**
 * Multi-dish prep planner: pick how many of each dish you're cooking and get
 * one combined shopping list. Ingredients shared between dishes are summed,
 * so 20 biryani + 30 shoarma gives a single onion figure rather than two.
 */
export default function ProductionPlanner({
  dishes,
  recipes,
  ingredients,
}: {
  dishes: PlannerDish[];
  recipes: StoredRecipe[];
  ingredients: StoredIngredient[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const lookup = useMemo(() => indexIngredients(ingredients), [ingredients]);
  const names = useMemo(
    () => Object.fromEntries(dishes.map((d) => [d.slug, d.name])),
    [dishes]
  );

  const plan = useMemo(
    () =>
      buildProductionPlan(
        dishes.map((d) => ({
          menuItemSlug: d.slug,
          portions: counts[d.slug] ?? 0,
        })),
        recipes,
        lookup,
        names
      ),
    [dishes, counts, recipes, lookup, names]
  );

  const hasPlan = plan.rows.length > 0;

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      {/* pick dishes */}
      <Card>
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-ember-600" />
          <h2 className="font-display text-lg font-semibold text-heading">
            What are you cooking?
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Set the number of portions for each dish.
        </p>

        <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
          {dishes.map((dish) => (
            <li
              key={dish.slug}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-heading">
                  {dish.name}
                </p>
                <p className="text-xs text-muted">{dish.portionWeightG} g portion</p>
              </div>
              <input
                type="number"
                min={0}
                value={counts[dish.slug] ?? ""}
                placeholder="0"
                aria-label={`Portions of ${dish.name}`}
                onChange={(e) =>
                  setCounts((prev) => ({
                    ...prev,
                    [dish.slug]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="h-10 w-20 shrink-0 rounded-lg border border-hairline text-center font-display text-sm font-semibold text-heading focus:border-ember-500 focus:outline-none"
              />
            </li>
          ))}
        </ul>

        {hasPlan && (
          <div className="mt-4 rounded-xl bg-canvas p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Total portions</span>
              <span className="font-display text-lg font-semibold text-heading">
                {plan.totalPortions}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-muted">Ingredient cost</span>
              <span className="font-display text-lg font-semibold text-heading">
                {formatMoney(plan.totalCost)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* shopping list */}
      <Card>
        <div className="flex items-center gap-2">
          <ShoppingBasket size={18} className="text-ember-600" />
          <h2 className="font-display text-lg font-semibold text-heading">
            Combined shopping list
          </h2>
        </div>

        {!hasPlan ? (
          <p className="py-16 text-center text-sm text-muted">
            Enter portions on the left and the totals appear here.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {plan.byGroup.map(({ group, rows }) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                  {GROUP_LABELS[group]}
                </p>
                <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                  {rows.map((row) => (
                    <li key={row.ingredient.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-heading">
                          {row.ingredient.name}
                        </p>
                        <p className="shrink-0 font-display text-sm font-semibold text-heading">
                          {row.display}
                        </p>
                      </div>
                      {row.usedIn.length > 1 && (
                        <p className="mt-1 text-xs text-faint">
                          {row.usedIn
                            .map((u) => `${u.itemName} ${u.display}`)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
