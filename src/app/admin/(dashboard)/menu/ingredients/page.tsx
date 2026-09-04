import Link from "next/link";
import { Pencil, Plus, TriangleAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { listAllergens, listIngredients } from "@/lib/admin/store";
import { deleteIngredientAction } from "@/app/admin/(dashboard)/menu/actions";
import { GROUP_LABELS, type IngredientGroup } from "@/lib/admin/ingredients";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Ingredients" };
export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  const [ingredients, allergenList] = await Promise.all([
    listIngredients(),
    listAllergens(),
  ]);
  const allergenLabel = (id: string) =>
    allergenList.find((a) => a.id === id)?.label ?? id;
  const groups = [...new Set(ingredients.map((i) => i.group))] as IngredientGroup[];

  return (
    <AdminShell title="Ingredients">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Ingredient library
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Recipes are built from these. Cost drives every food-cost and
              margin figure in the panel, so keeping prices current here keeps
              the whole system honest.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/menu/allergens"
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
          >
            Manage allergens
          </Link>
          <Link
            href="/admin/menu/ingredients/new"
            className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <Plus size={16} />
            Add ingredient
          </Link>
          </div>
        </Card>

        <Card className="flex items-start gap-3 border-warn/30 bg-warn-soft">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-sm leading-relaxed text-warn">
            <span className="font-semibold">
              The seeded prices are invented.
            </span>{" "}
            They exist so the costing maths has something to work with. Edit
            them to your real supplier prices before trusting any margin figure.
          </p>
        </Card>

        {groups.map((group) => (
          <Card key={group} padded={false}>
            <p className="px-5 py-4 font-display text-base font-semibold text-heading sm:px-6">
              {GROUP_LABELS[group]}
            </p>

            <div className="overflow-x-auto border-t border-hairline">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="bg-canvas/60">
                    {["Ingredient", "Priced per", "Cost", "Allergens", ""].map(
                      (h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-5 py-2.5 text-xs font-semibold text-muted sm:px-6"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {ingredients
                    .filter((i) => i.group === group)
                    .map((ingredient) => (
                      <tr key={ingredient.id} className="hover:bg-canvas/60">
                        <td className="px-5 py-3.5 text-sm font-medium text-heading sm:px-6">
                          {ingredient.name}
                          {ingredient.supplier && (
                            <span className="ml-2 text-xs font-normal text-faint">
                              {ingredient.supplier}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted sm:px-6">
                          1 {ingredient.unit}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-heading sm:px-6">
                          {formatMoney(ingredient.costPerUnit)}
                        </td>
                        <td className="px-5 py-3.5 sm:px-6">
                          {ingredient.allergens.length === 0 ? (
                            <span className="text-sm text-faint">—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1.5">
                              {ingredient.allergens.map((a) => (
                                <span
                                  key={a}
                                  className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-body-text"
                                >
                                  {allergenLabel(a)}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/admin/menu/ingredients/${ingredient.id}/edit`}
                              aria-label={`Edit ${ingredient.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                            >
                              <Pencil size={15} />
                            </Link>
                            <DeleteButton
                              action={deleteIngredientAction}
                              hiddenField={{ name: "id", value: ingredient.id }}
                              label={`Delete ${ingredient.name}`}
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
