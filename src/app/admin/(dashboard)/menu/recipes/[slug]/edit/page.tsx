import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import RecipeForm from "@/components/admin/RecipeForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { getItem, getRecipe, listAllergens, listIngredients } from "@/lib/admin/store";
import { deleteRecipeAction, saveRecipeAction } from "@/app/admin/(dashboard)/menu/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getItem(slug);
  return { title: item ? `Recipe — ${item.name}` : "Recipe" };
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, recipe, ingredients, allergens] = await Promise.all([
    getItem(slug),
    getRecipe(slug),
    listIngredients(),
    listAllergens(),
  ]);
  if (!item) notFound();

  return (
    <AdminShell title={`${recipe ? "Edit" : "New"} recipe`}>
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Link
          href={`/admin/menu/recipes/${slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to {item.name}
        </Link>

        <Card>
          <CardHeader
            title={`${recipe ? "Edit" : "New"} recipe — ${item.name}`}
            subtitle="Costs, yield and allergens update live as you type."
          />
          <div className="mt-6">
            <RecipeForm
              action={saveRecipeAction}
              slug={slug}
              itemName={item.name}
              sellPrice={item.price}
              ingredients={ingredients}
              allergens={allergens}
              recipe={recipe}
            />
          </div>
        </Card>

        {recipe && (
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-heading">
                Delete this recipe
              </h3>
              <p className="mt-1 text-sm text-muted">
                {item.name} stays on the menu; only the recipe is removed.
              </p>
            </div>
            <DeleteButton
              action={deleteRecipeAction}
              hiddenField={{ name: "menuItemSlug", value: slug }}
              label="Delete recipe"
            />
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
