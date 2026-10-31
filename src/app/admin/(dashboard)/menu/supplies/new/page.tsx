import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SupplyForm from "@/components/admin/SupplyForm";
import { createSupplyAction } from "@/app/admin/(dashboard)/menu/supplies/actions";

export const metadata = { title: "Add supply" };

export default function NewSupplyPage() {
  return (
    <AdminShell title="Add supply">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/supplies"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to supplies
        </Link>
        <Card>
          <CardHeader
            title="New supply"
            subtitle="Something the kitchen buys that isn't food: packaging, gloves, paper."
          />
          <div className="mt-6">
            <SupplyForm action={createSupplyAction} />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
