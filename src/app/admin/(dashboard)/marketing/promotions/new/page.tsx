import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import PromoCodeForm from "@/components/admin/PromoCodeForm";
import { listCategories, listItems, listMedia } from "@/lib/admin/store";
import { createPromoCodeAction } from "@/app/admin/(dashboard)/marketing/promotions/actions";

export const metadata = { title: "Add promo code" };

export default async function NewPromoCodePage() {
  const [categories, items, media] = await Promise.all([listCategories(), listItems(), listMedia()]);
  return (
    <AdminShell title="Add promo code">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/marketing/promotions"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to promo codes
        </Link>

        <PromoCodeForm
          action={createPromoCodeAction}
          submitLabel="Create code"
          categories={categories}
          items={items}
          media={media}
        />
      </div>
    </AdminShell>
  );
}
