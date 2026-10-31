import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import MeasurementForm from "@/components/admin/MeasurementForm";
import { createMeasurementAction } from "@/app/admin/(dashboard)/menu/measurements/actions";
import { listIngredients, listMeasurements } from "@/lib/admin/store";

export const metadata = { title: "Add measurement" };
export const dynamic = "force-dynamic";

export default async function NewMeasurementPage() {
  const [ingredients, measurements] = await Promise.all([listIngredients(), listMeasurements()]);
  const takenBy = new Map(measurements.filter((m) => m.ingredientId).map((m) => [m.ingredientId!, m.nameEn]));

  return (
    <AdminShell title="Add measurement">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/measurements"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to the chart
        </Link>
        <Card>
          <CardHeader title="New measurement" subtitle="Weigh a level spoon of it and record the grams." />
          <div className="mt-6">
            <MeasurementForm
              action={createMeasurementAction}
              ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, takenBy: takenBy.get(i.id) }))}
            />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
