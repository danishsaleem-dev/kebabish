import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import ItemForm from "@/components/admin/ItemForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import {
  getItem,
  getRecipe,
  listAllergens,
  listCategories,
  listIngredients,
  listMedia,
  listOptionGroups,
} from "@/lib/admin/store";
import {
  deleteItemAction,
  saveRecipeAction,
  updateItemAction,
} from "@/app/admin/(dashboard)/menu/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getItem(slug);
  return { title: item ? `Edit ${item.name}` : "Edit item" };
}

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, categories, library, optionGroups, allergens, recipe, ingredients] =
    await Promise.all([
      getItem(slug),
      listCategories(),
      listMedia(),
      listOptionGroups(),
      listAllergens(),
      getRecipe(slug),
      listIngredients(),
    ]);
  if (!item) notFound();

  return (
    <AdminShell title={item.name}>
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <ItemForm
          action={updateItemAction}
          categories={categories}
          item={item}
          library={library}
          optionGroups={optionGroups}
          allergens={allergens}
          recipe={recipe}
          ingredients={ingredients}
          recipeAction={saveRecipeAction}
        />

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">
              Delete this dish
            </h3>
            <p className="mt-1 text-sm text-muted">
              Removes {item.name} and its recipe. This can&apos;t be undone.
            </p>
          </div>
          <DeleteButton
            action={deleteItemAction}
            hiddenField={{ name: "slug", value: item.slug }}
            label="Delete dish"
          />
        </Card>
      </div>
    </AdminShell>
  );
}
