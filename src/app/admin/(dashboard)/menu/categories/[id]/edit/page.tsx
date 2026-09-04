import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import CategoryForm from "@/components/admin/CategoryForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { getCategory, listItems, listMedia } from "@/lib/admin/store";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/admin/(dashboard)/menu/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategory(id);
  return { title: category ? `Edit ${category.label}` : "Edit category" };
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [category, items, library] = await Promise.all([
    getCategory(id),
    listItems(),
    listMedia(),
  ]);
  if (!category) notFound();

  const count = items.filter((i) => i.categoryId === id).length;

  return (
    <AdminShell title={`Edit ${category.label}`}>
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/categories"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to categories
        </Link>

        <Card>
          <CardHeader title="Category details" />
          <div className="mt-6">
            <CategoryForm
              action={updateCategoryAction}
              category={category}
              library={library}
            />
          </div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">
              Delete this category
            </h3>
            <p className="mt-1 text-sm text-muted">
              {count === 0
                ? "It has no dishes, so it's safe to remove."
                : `It still holds ${count} dish${count === 1 ? "" : "es"} — move them first.`}
            </p>
          </div>
          <DeleteButton
            action={deleteCategoryAction}
            hiddenField={{ name: "id", value: category.id }}
            label="Delete category"
          />
        </Card>
      </div>
    </AdminShell>
  );
}
