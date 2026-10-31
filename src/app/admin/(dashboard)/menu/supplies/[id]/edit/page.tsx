import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SupplyForm from "@/components/admin/SupplyForm";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { getSupply } from "@/lib/admin/store";
import {
  deleteSupplyAction,
  updateSupplyAction,
} from "@/app/admin/(dashboard)/menu/supplies/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supply = await getSupply(id);
  return { title: supply ? `Edit ${supply.name}` : "Edit supply" };
}

export default async function EditSupplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supply = await getSupply(id);
  if (!supply) notFound();

  return (
    <AdminShell title={`Edit ${supply.name}`}>
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/supplies"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to supplies
        </Link>
        <Card>
          <CardHeader title="Supply details" />
          <div className="mt-6">
            <SupplyForm action={updateSupplyAction} supply={supply} />
          </div>
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-heading">Delete this supply</h3>
            <p className="mt-1 text-sm text-muted">
              Purchases already logged for it are kept, under the name it had when they were bought.
            </p>
          </div>
          <DeleteButton
            action={deleteSupplyAction}
            hiddenField={{ name: "id", value: supply.id }}
            label="Delete supply"
          />
        </Card>
      </div>
    </AdminShell>
  );
}
