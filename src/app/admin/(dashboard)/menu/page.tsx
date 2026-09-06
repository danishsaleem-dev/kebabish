import Link from "next/link";
import { Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import ItemsTable, { type ItemRow } from "@/components/admin/ItemsTable";
import { listCategories, listIngredients, listItems, listRecipes } from "@/lib/admin/store";
import { analyseRecipe, indexIngredients } from "@/lib/admin/recipe-math";

export const metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const [categories, items, recipes, ingredients] = await Promise.all([
    listCategories(),
    listItems(),
    listRecipes(),
    listIngredients(),
  ]);

  const lookup = indexIngredients(ingredients);
  const recipeBySlug = new Map(recipes.map((r) => [r.menuItemSlug, r]));
  const categoryLabel = new Map(categories.map((c) => [c.id, c.label]));

  const rows: ItemRow[] = items.map((item) => {
    const recipe = recipeBySlug.get(item.slug);
    const analysis = recipe ? analyseRecipe(recipe, lookup, item.price) : null;
    return {
      item,
      categoryLabel: categoryLabel.get(item.categoryId) ?? "Uncategorised",
      costPerPortion: analysis?.costPerPortion ?? null,
    };
  });

  return (
    <AdminShell title="Menu">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Menu
            </h2>
            <p className="mt-1 text-sm text-muted">
              {items.length} dishes across {categories.length} categories.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/menu/categories"
              className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
            >
              Manage categories
            </Link>
            <Link
              href="/admin/menu/items/new"
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <Plus size={16} />
              Add item
            </Link>
          </div>
        </Card>

        {items.length === 0 ? (
          <Card className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <h3 className="font-display text-lg font-semibold text-heading">
              No dishes yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Add your first dish, or set up categories first if you&apos;d
              like to organise before you start.
            </p>
            <Link
              href="/admin/menu/items/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <Plus size={16} />
              Add item
            </Link>
          </Card>
        ) : (
          <ItemsTable rows={rows} categories={categories} />
        )}
      </div>
    </AdminShell>
  );
}
