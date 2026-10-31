import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import MeasurementForm from "@/components/admin/MeasurementForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { getMeasurement, listIngredients, listMeasurements } from "@/lib/admin/store";
import {
  deleteMeasurementAction,
  updateMeasurementAction,
} from "@/app/admin/(dashboard)/menu/measurements/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMeasurement(id);
  return { title: m ? `Edit ${m.nameEn}` : "Edit measurement" };
}

export default async function EditMeasurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [measurement, ingredients, measurements] = await Promise.all([
    getMeasurement(id),
    listIngredients(),
    listMeasurements(),
  ]);
  if (!measurement) notFound();
  const takenBy = new Map(measurements.filter((m) => m.ingredientId).map((m) => [m.ingredientId!, m.nameEn]));

  return (
    <AdminShell title={`Edit ${measurement.nameEn}`}>
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/measurements"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to the chart
        </Link>
        <Card>
          <CardHeader title="Measurement details" />
          <div className="mt-6">
            <MeasurementForm
              action={updateMeasurementAction}
              measurement={measurement}
              ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, takenBy: takenBy.get(i.id) }))}
            />
          </div>
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">Delete this row</h3>
            <p className="mt-1 text-sm text-muted">Only removes the measurement. The ingredient itself is untouched.</p>
          </div>
          <DeleteButton
            action={deleteMeasurementAction}
            hiddenField={{ name: "id", value: measurement.id }}
            label="Delete measurement"
          />
        </Card>
      </div>
    </AdminShell>
  );
}
