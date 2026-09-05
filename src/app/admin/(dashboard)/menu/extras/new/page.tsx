import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import OptionGroupForm from "@/components/admin/OptionGroupForm";
import { createOptionGroupAction } from "@/app/admin/(dashboard)/menu/actions";

export const metadata = { title: "Add extras group" };

export default function NewOptionGroupPage() {
  return (
    <AdminShell title="Add extras group">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/extras"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to extras
        </Link>

        <OptionGroupForm action={createOptionGroupAction} submitLabel="Create group" />
      </div>
    </AdminShell>
  );
}
