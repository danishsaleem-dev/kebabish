import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import DealForm, { type DealDish } from "@/components/admin/DealForm";
import { updateDealAction } from "@/app/admin/(dashboard)/menu/deals/actions";
import { getDeal, listCategories, listItems, listMedia } from "@/lib/admin/store";

export const metadata = { title: "Edit deal" };
export const dynamic = "force-dynamic";

export default async function EditDealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [deal, items, categories, library] = await Promise.all([
    getDeal(slug),
    listItems(),
    listCategories(),
    listMedia(),
  ]);
  if (!deal) notFound();

  const dishes: DealDish[] = items.map((i) => ({
    slug: i.slug,
    name: i.name,
    price: i.price,
    category: categories.find((c) => c.id === i.categoryId)?.label ?? "Other",
  }));

  return (
    <AdminShell title="Edit deal">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/deals"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to deals
        </Link>
        <DealForm deal={deal} dishes={dishes} library={library} action={updateDealAction} submitLabel="Save deal" />
      </div>
    </AdminShell>
  );
}
