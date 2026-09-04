import Link from "next/link";
import { ChevronRight, CircleAlert, Flame, Leaf, Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import { listCategories, listIngredients, listItems, listRecipes } from "@/lib/admin/store";
import { analyseRecipe, indexIngredients } from "@/lib/admin/recipe-math";
import { formatMoney } from "@/lib/admin/units";

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

  return (
    <AdminShell title="Menu">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              All items
            </h2>
            <p className="mt-1 text-sm text-muted">
              {items.length} dishes across {categories.length} categories. Open a
              dish to manage its recipe.
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

        {categories.map((category) => {
          const categoryItems = items.filter((i) => i.categoryId === category.id);

          return (
            <Card key={category.id} padded={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                <div>
                  <h3 className="font-display text-base font-semibold text-heading">
                    {category.label}
                    {!category.visible && (
                      <span className="ml-2 rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
                        hidden
                      </span>
                    )}
                  </h3>
                  {category.description && (
                    <p className="mt-0.5 text-sm text-muted">
                      {category.description}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted">
                  {categoryItems.length} items
                </span>
              </div>

              {categoryItems.length === 0 ? (
                <p className="border-t border-hairline px-5 py-6 text-sm text-muted sm:px-6">
                  No dishes in this category yet.
                </p>
              ) : (
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
                          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-canvas/60 sm:px-6"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 truncate text-sm font-semibold text-heading">
                              {item.name}
                              {item.vegetarian && (
                                <Leaf size={14} className="shrink-0 text-success" />
                              )}
                              {item.spicy && (
                                <Flame size={14} className="shrink-0 text-danger" />
                              )}
                              {item.soldOut && (
                                <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                                  sold out
                                </span>
                              )}
                            </p>
                            {item.variants.length > 0 && (
                              <p className="mt-0.5 truncate text-xs text-muted">
                                {item.variants.join(" · ")}
                              </p>
                            )}
                          </div>

                          <div className="hidden w-28 shrink-0 text-right sm:block">
                            <p className="text-xs text-faint">Price</p>
                            <p className="text-sm font-semibold text-heading">
                              {item.price != null ? (
                                formatMoney(item.price)
                              ) : (
                                <span className="inline-flex items-center gap-1 text-warn">
                                  <CircleAlert size={13} />
                                  Not set
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="hidden w-32 shrink-0 text-right md:block">
                            <p className="text-xs text-faint">Recipe</p>
                            {analysis ? (
                              <p className="text-sm font-semibold text-heading">
                                {formatMoney(analysis.costPerPortion)}
                                <span className="ml-1 text-xs font-normal text-muted">
                                  /portion
                                </span>
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-faint">
                                Not added
                              </p>
                            )}
                          </div>

                          <ChevronRight size={18} className="shrink-0 text-faint" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
