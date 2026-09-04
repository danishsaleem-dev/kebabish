import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import ProductionPlanner, {
  type PlannerDish,
} from "@/components/admin/ProductionPlanner";
import { listIngredients, listItems, listRecipes } from "@/lib/admin/store";

export const metadata = { title: "Production planner" };
export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const [recipes, items, ingredients] = await Promise.all([
    listRecipes(),
    listItems(),
    listIngredients(),
  ]);

  const nameBySlug = new Map(items.map((i) => [i.slug, i.name]));

  const dishes: PlannerDish[] = recipes.flatMap((recipe) => {
    const name = nameBySlug.get(recipe.menuItemSlug);
    if (!name) return [];
    return [
      {
        slug: recipe.menuItemSlug,
        name,
        portionWeightG: recipe.portionWeightG,
      },
    ];
  });

  return (
    <AdminShell title="Production planner">
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <h2 className="font-display text-lg font-semibold text-heading">
            Plan a cook
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Set how many portions of each dish you&apos;re making and get one
            combined ingredient list. Shared ingredients are added together, so
            onion used in three different dishes shows as a single figure to buy
            and prep.
          </p>
        </Card>

        {dishes.length === 0 ? (
          <Card>
            <p className="py-12 text-center text-sm text-muted">
              No dishes have recipes yet. Add a recipe and it appears here.
            </p>
          </Card>
        ) : (
          <ProductionPlanner
            dishes={dishes}
            recipes={recipes}
            ingredients={ingredients}
          />
        )}
      </div>
    </AdminShell>
  );
}
