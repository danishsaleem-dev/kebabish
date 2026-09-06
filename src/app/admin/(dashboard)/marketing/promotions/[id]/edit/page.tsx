import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import PromoCodeForm from "@/components/admin/PromoCodeForm";
import { updatePromoCodeAction } from "@/app/admin/(dashboard)/marketing/promotions/actions";
import { getPromoCode } from "@/lib/admin/store";

export const metadata = { title: "Edit promo code" };
export const dynamic = "force-dynamic";

export default async function EditPromoCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promo = await getPromoCode(id);
  if (!promo) notFound();

  return (
    <AdminShell title="Edit promo code">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/marketing/promotions"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to promo codes
        </Link>

        <PromoCodeForm
          promo={promo}
          action={updatePromoCodeAction}
          submitLabel="Save code"
        />
      </div>
    </AdminShell>
  );
}
