import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import IngredientForm from "@/components/admin/IngredientForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { getIngredient, listAllergens, listMeasurements, listRecipes } from "@/lib/admin/store";
import {
  deleteIngredientAction,
  updateIngredientAction,
} from "@/app/admin/(dashboard)/menu/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ingredient = await getIngredient(id);
  return { title: ingredient ? `Edit ${ingredient.name}` : "Edit ingredient" };
}

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ingredient, recipes, allergens, measurements] = await Promise.all([
    getIngredient(id),
    listRecipes(),
    listAllergens(),
    listMeasurements(),
  ]);
  if (!ingredient) notFound();
  const spoons = measurements.find((m) => m.ingredientId === id);

  const usedBy = recipes.filter((r) =>
    r.lines.some((l) => l.ingredientId === id)
  ).length;

  return (
    <AdminShell title={`Edit ${ingredient.name}`}>
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/ingredients"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to ingredients
        </Link>

        <Card>
          <CardHeader
            title="Ingredient details"
            subtitle={
              usedBy > 0
                ? `Used in ${usedBy} recipe${usedBy === 1 ? "" : "s"} — changing the cost updates their margins.`
                : "Not used in any recipe yet."
            }
          />
          <div className="mt-6">
            <IngredientForm
              action={updateIngredientAction}
              ingredient={ingredient}
              allergens={allergens}
            />
          </div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">Spoon measurements</h3>
            <p className="mt-1 text-sm text-muted">
              {spoons
                ? [
                    spoons.gramsPerTbsp !== undefined ? `1 tbsp = ${spoons.gramsPerTbsp} g` : null,
                    spoons.gramsPerTsp !== undefined ? `1 tsp = ${spoons.gramsPerTsp} g` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Listed on the chart, but no grams recorded yet."
                : "Not on the measurement chart yet."}
            </p>
          </div>
          <Link
            href={spoons ? `/admin/menu/measurements/${spoons.id}/edit` : "/admin/menu/measurements/new"}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
          >
            {spoons ? "Edit measurement" : "Add measurement"}
          </Link>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">
              Delete this ingredient
            </h3>
            <p className="mt-1 text-sm text-muted">
              {usedBy === 0
                ? "Not used anywhere, so it's safe to remove."
                : `Still used in ${usedBy} recipe${usedBy === 1 ? "" : "s"} — remove it there first.`}
            </p>
          </div>
          <DeleteButton
            action={deleteIngredientAction}
            hiddenField={{ name: "id", value: ingredient.id }}
            label="Delete ingredient"
          />
        </Card>
      </div>
    </AdminShell>
  );
}
