import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import ItemForm from "@/components/admin/ItemForm";
import { listCategories, listMedia } from "@/lib/admin/store";
import { createItemAction } from "@/app/admin/(dashboard)/menu/actions";

export const metadata = { title: "Add item" };
export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const [categories, library] = await Promise.all([
    listCategories(),
    listMedia(),
  ]);

  return (
    <AdminShell title="Add item">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <Card>
          <CardHeader
            title="New dish"
            subtitle="You can add its recipe straight after saving."
          />
          <div className="mt-6">
            <ItemForm
              action={createItemAction}
              categories={categories}
              library={library}
            />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
