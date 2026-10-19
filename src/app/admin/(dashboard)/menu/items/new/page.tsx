import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import ItemForm from "@/components/admin/ItemForm";
import {
  listAllergens,
  listCategories,
  listItems,
  listMedia,
  listOptionGroups,
} from "@/lib/admin/store";
import { createItemAction } from "@/app/admin/(dashboard)/menu/actions";
import { stockIsSetUp } from "@/lib/stock";

export const metadata = { title: "Add item" };
export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const [categories, library, optionGroups, allergens, items, stockSetUp] = await Promise.all([
    listCategories(),
    listMedia(),
    listOptionGroups(),
    listAllergens(),
    listItems(),
    stockIsSetUp(),
  ]);

  return (
    <AdminShell title="Add item">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/menu"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
          >
            <ArrowLeft size={16} />
            Back to menu
          </Link>
          <p className="text-sm text-muted">
            You can add its recipe straight after saving.
          </p>
        </div>

        <ItemForm
          action={createItemAction}
          categories={categories}
          library={library}
          optionGroups={optionGroups}
          allergens={allergens}
          dishes={items.map((i) => ({ slug: i.slug, name: i.name }))}
          stock={{ setUp: stockSetUp, entry: null }}
        />
      </div>
    </AdminShell>
  );
}
