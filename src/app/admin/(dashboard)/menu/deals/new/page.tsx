import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import DealForm, { type DealDish } from "@/components/admin/DealForm";
import { createDealAction } from "@/app/admin/(dashboard)/menu/deals/actions";
import { listCategories, listItems, listMedia } from "@/lib/admin/store";

export const metadata = { title: "Add deal" };
export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const [items, categories, library] = await Promise.all([listItems(), listCategories(), listMedia()]);
  const dishes: DealDish[] = items.map((i) => ({
    slug: i.slug,
    name: i.name,
    price: i.price,
    category: categories.find((c) => c.id === i.categoryId)?.label ?? "Other",
  }));

  return (
    <AdminShell title="Add deal">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/deals"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to deals
        </Link>
        <DealForm dishes={dishes} library={library} action={createDealAction} submitLabel="Create deal" />
      </div>
    </AdminShell>
  );
}
