import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import AllergenManager from "@/components/admin/AllergenManager";
import { listAllergens, listIngredients } from "@/lib/admin/store";

export const metadata = { title: "Allergens" };
export const dynamic = "force-dynamic";

export default async function AllergensPage() {
  const [allergens, ingredients] = await Promise.all([
    listAllergens(),
    listIngredients(),
  ]);

  const usage = Object.fromEntries(
    allergens.map((a) => [
      a.id,
      ingredients.filter((i) => i.allergens.includes(a.id)).length,
    ])
  );

  return (
    <AdminShell title="Allergens">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/ingredients"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to ingredients
        </Link>

        <Card className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div>
            <CardHeader title="Allergen list" />
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Tag these on ingredients and they roll up automatically to every
              dish. The 14 marked <strong>EU required</strong> are mandatory
              under regulation 1169/2011 — you can rename them to suit your
              wording, but not remove them. Add your own for anything else you
              want to flag.
            </p>
          </div>
        </Card>

        <AllergenManager allergens={allergens} usage={usage} />
      </div>
    </AdminShell>
  );
}
