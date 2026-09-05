import Link from "next/link";
import { Scale, CheckCircle2, Circle } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import {
  listCategories,
  listItems,
  listIngredients,
  listRecipes,
} from "@/lib/admin/store";
import { analyseRecipe, indexIngredients } from "@/lib/admin/recipe-math";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Recipes" };
export const dynamic = "force-dynamic";

/**
 * Every dish, grouped by category, with its recipe status — the index
 * that was missing. Recipe pages themselves only ever existed at
 * /admin/menu/recipes/[slug], reachable before only by clicking into a
 * specific dish; there was no way to see "which dishes still need a
 * recipe" at a glance or jump straight to one.
 */
export default async function RecipesIndexPage() {
  const [categories, items, recipes, ingredients] = await Promise.all([
    listCategories(),
    listItems(),
    listRecipes(),
    listIngredients(),
  ]);

  const lookup = indexIngredients(ingredients);
  const recipeBySlug = new Map(recipes.map((r) => [r.menuItemSlug, r]));
  const withRecipe = items.filter((i) => recipeBySlug.has(i.slug)).length;

  const grouped = [...categories]
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      category,
      items: items.filter((i) => i.categoryId === category.id),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <AdminShell title="Recipes">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Card className="flex items-start gap-3">
          <Scale size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div>
            <CardHeader
              title="Recipes"
              subtitle={`${withRecipe} of ${items.length} dishes have a recipe. A dish needs one to join the batch calculator and the production planner.`}
            />
          </div>
        </Card>

        {grouped.map(({ category, items: categoryItems }) => (
          <Card key={category.id} padded={false}>
            <div className="p-5 sm:p-6">
              <CardHeader title={category.label} />
            </div>
            <ul className="divide-y divide-hairline border-t border-hairline">
              {categoryItems.map((item) => {
                const recipe = recipeBySlug.get(item.slug);
                const analysis = recipe
                  ? analyseRecipe(recipe, lookup, item.price)
                  : null;

                return (
                  <li key={item.slug}>
                    <Link
                      href={`/admin/menu/recipes/${item.slug}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-canvas sm:px-6"
                    >
                      {recipe ? (
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-success"
                          aria-label="Has a recipe"
                        />
                      ) : (
                        <Circle
                          size={18}
                          className="shrink-0 text-faint"
                          aria-label="No recipe yet"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-heading">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {recipe
                            ? `${recipe.batchPortions} portions of ${recipe.portionWeightG} g`
                            : "No recipe yet"}
                        </p>
                      </div>

                      {analysis && (
                        <p className="shrink-0 font-display text-sm font-semibold text-heading">
                          {formatMoney(analysis.costPerPortion)}
                          <span className="ml-1 font-normal text-muted">
                            / portion
                          </span>
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
