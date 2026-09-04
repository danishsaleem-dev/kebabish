import {
  DIMENSION_OF,
  formatQuantity,
  toBase,
  type Dimension,
  type Unit,
} from "@/lib/admin/units";
import type { Allergen, Ingredient, IngredientGroup } from "@/lib/admin/ingredients";
import type { Recipe, RecipeLine } from "@/lib/admin/recipes";

/**
 * All recipe arithmetic, as pure functions.
 *
 * Nothing here reads from a data file — ingredients are always passed in — so
 * the same code serves the static prototype data, the JSON store, and later
 * Supabase, and stays trivially testable.
 */

export type IngredientLookup = Map<string, Ingredient>;

export function indexIngredients(ingredients: Ingredient[]): IngredientLookup {
  return new Map(ingredients.map((i) => [i.id, i]));
}

export interface ResolvedLine {
  line: RecipeLine;
  ingredient: Ingredient;
  /** Quantity in the dimension's base unit (g / ml / pcs). */
  baseQuantity: number;
  dimension: Dimension;
  /** Human-readable, e.g. "1.2 kg". */
  display: string;
  cost: number;
}

/**
 * Cost of a single line. Returns 0 when a line's unit doesn't match the
 * dimension the ingredient is purchased in (e.g. millilitres against an
 * ingredient priced per kilo) rather than inventing a density conversion.
 */
export function lineCost(
  ingredient: Ingredient,
  quantity: number,
  unit: Unit
): number {
  if (DIMENSION_OF[unit] !== DIMENSION_OF[ingredient.unit]) return 0;
  const perBaseUnit = ingredient.costPerUnit / toBase(1, ingredient.unit);
  return toBase(quantity, unit) * perBaseUnit;
}

/** Resolve a recipe's lines against an ingredient lookup at a given scale. */
export function resolveLines(
  recipe: Recipe,
  lookup: IngredientLookup,
  factor = 1
): ResolvedLine[] {
  return recipe.lines.flatMap((line) => {
    const ingredient = lookup.get(line.ingredientId);
    if (!ingredient) return [];

    const quantity = line.quantity * factor;
    const dimension = DIMENSION_OF[line.unit];
    const baseQuantity = toBase(quantity, line.unit);

    return [
      {
        line,
        ingredient,
        baseQuantity,
        dimension,
        display: formatQuantity(baseQuantity, dimension),
        cost: lineCost(ingredient, quantity, line.unit),
      },
    ];
  });
}

export interface RecipeAnalysis {
  recipe: Recipe;
  lines: ResolvedLine[];
  /** Combined weight of the edible inputs, grams (ml counted as g). */
  rawInputG: number;
  /** portionWeightG × batchPortions */
  platedWeightG: number;
  /**
   * Plated ÷ raw. Below 1 means the dish loses weight in cooking (water
   * boiling off); above 1 means it gains (rice absorbing stock).
   */
  yieldFactor: number;
  costPerBatch: number;
  costPerPortion: number;
  allergens: Allergen[];
  marginPct: number | null;
}

export function analyseRecipe(
  recipe: Recipe,
  lookup: IngredientLookup,
  sellPrice: number | null = null
): RecipeAnalysis {
  const lines = resolveLines(recipe, lookup);

  // Packaging isn't food — it must not skew the yield figure.
  const rawInputG = lines
    .filter((l) => l.ingredient.group !== "packaging" && l.dimension !== "count")
    .reduce((sum, l) => sum + l.baseQuantity, 0);

  const platedWeightG = recipe.portionWeightG * recipe.batchPortions;
  const costPerBatch = lines.reduce((sum, l) => sum + l.cost, 0);
  const costPerPortion = recipe.batchPortions
    ? costPerBatch / recipe.batchPortions
    : 0;

  const allergens = [
    ...new Set(lines.flatMap((l) => l.ingredient.allergens)),
  ].sort();

  return {
    recipe,
    lines,
    rawInputG,
    platedWeightG,
    yieldFactor: rawInputG > 0 ? platedWeightG / rawInputG : 0,
    costPerBatch,
    costPerPortion,
    allergens,
    marginPct:
      sellPrice && sellPrice > 0
        ? ((sellPrice - costPerPortion) / sellPrice) * 100
        : null,
  };
}

/** "How much do I need for 20 plates?" */
export function scaleToPortions(
  recipe: Recipe,
  targetPortions: number,
  lookup: IngredientLookup
) {
  const factor = recipe.batchPortions
    ? targetPortions / recipe.batchPortions
    : 0;
  const lines = resolveLines(recipe, lookup, factor);

  return {
    factor,
    targetPortions,
    lines,
    totalCost: lines.reduce((sum, l) => sum + l.cost, 0),
    totalPlatedG: recipe.portionWeightG * targetPortions,
  };
}

export interface ProductionEntry {
  menuItemSlug: string;
  portions: number;
}

export interface AggregatedIngredient {
  ingredient: Ingredient;
  baseQuantity: number;
  dimension: Dimension;
  display: string;
  cost: number;
  /** Which dishes contributed, for the "why do I need 6 kg of onion" question. */
  usedIn: { itemName: string; display: string }[];
}

export interface ProductionPlan {
  rows: AggregatedIngredient[];
  byGroup: { group: IngredientGroup; rows: AggregatedIngredient[] }[];
  totalCost: number;
  totalPortions: number;
  dishes: { itemName: string; portions: number; cost: number }[];
}

/**
 * Combine several dishes into one shopping list — the Friday-prep view.
 * Ingredients shared across dishes are summed, not repeated.
 */
export function buildProductionPlan(
  entries: ProductionEntry[],
  recipes: Recipe[],
  lookup: IngredientLookup,
  itemNames: Record<string, string> = {}
): ProductionPlan {
  const totals = new Map<string, AggregatedIngredient>();
  const dishes: ProductionPlan["dishes"] = [];
  const recipeBySlug = new Map(recipes.map((r) => [r.menuItemSlug, r]));

  for (const entry of entries) {
    const recipe = recipeBySlug.get(entry.menuItemSlug);
    if (!recipe || entry.portions <= 0) continue;

    const scaled = scaleToPortions(recipe, entry.portions, lookup);
    const itemName = itemNames[entry.menuItemSlug] ?? entry.menuItemSlug;
    dishes.push({ itemName, portions: entry.portions, cost: scaled.totalCost });

    for (const line of scaled.lines) {
      const existing = totals.get(line.ingredient.id);

      if (existing) {
        existing.baseQuantity += line.baseQuantity;
        existing.cost += line.cost;
        existing.display = formatQuantity(existing.baseQuantity, existing.dimension);
        existing.usedIn.push({ itemName, display: line.display });
      } else {
        totals.set(line.ingredient.id, {
          ingredient: line.ingredient,
          baseQuantity: line.baseQuantity,
          dimension: line.dimension,
          display: line.display,
          cost: line.cost,
          usedIn: [{ itemName, display: line.display }],
        });
      }
    }
  }

  const rows = [...totals.values()].sort((a, b) =>
    a.ingredient.name.localeCompare(b.ingredient.name)
  );

  const groups = [...new Set(rows.map((r) => r.ingredient.group))];

  return {
    rows,
    byGroup: groups.map((group) => ({
      group,
      rows: rows.filter((r) => r.ingredient.group === group),
    })),
    totalCost: rows.reduce((sum, r) => sum + r.cost, 0),
    totalPortions: entries.reduce((sum, e) => sum + Math.max(0, e.portions), 0),
    dishes,
  };
}
