import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import IngredientForm from "@/components/admin/IngredientForm";
import { createIngredientAction } from "@/app/admin/(dashboard)/menu/actions";
import { listAllergens } from "@/lib/admin/store";

export const metadata = { title: "Add ingredient" };
export const dynamic = "force-dynamic";

export default async function NewIngredientPage() {
  const allergens = await listAllergens();

  return (
    <AdminShell title="Add ingredient">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/ingredients"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to ingredients
        </Link>

        <Card>
          <CardHeader
            title="New ingredient"
            subtitle="Price it the way your supplier sells it — per kilo, per litre or per piece."
          />
          <div className="mt-6">
            <IngredientForm action={createIngredientAction} allergens={allergens} />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
