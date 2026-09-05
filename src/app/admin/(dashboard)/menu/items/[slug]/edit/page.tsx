import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import ItemForm from "@/components/admin/ItemForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import {
  getItem,
  listCategories,
  listMedia,
  listOptionGroups,
} from "@/lib/admin/store";
import { deleteItemAction, updateItemAction } from "@/app/admin/(dashboard)/menu/actions";

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
  const [item, categories, library, optionGroups] = await Promise.all([
    getItem(slug),
    listCategories(),
    listMedia(),
    listOptionGroups(),
  ]);
  if (!item) notFound();

  return (
    <AdminShell title={`Edit ${item.name}`}>
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href={`/admin/menu/recipes/${item.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to {item.name}
        </Link>

        <Card>
          <CardHeader title="Dish details" />
          <div className="mt-6">
            <ItemForm
              action={updateItemAction}
              categories={categories}
              item={item}
              library={library}
              optionGroups={optionGroups}
            />
          </div>
        </Card>

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
