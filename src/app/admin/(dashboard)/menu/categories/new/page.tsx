import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import CategoryForm from "@/components/admin/CategoryForm";
import { createCategoryAction } from "@/app/admin/(dashboard)/menu/actions";
import { listMedia } from "@/lib/admin/store";

export const metadata = { title: "Add category" };
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const library = await listMedia();

  return (
    <AdminShell title="Add category">
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/categories"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to categories
        </Link>

        <Card>
          <CardHeader
            title="New category"
            subtitle="It's added to the end of the menu order; you can move it afterwards."
          />
          <div className="mt-6">
            <CategoryForm action={createCategoryAction} library={library} />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
