import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import OptionGroupForm from "@/components/admin/OptionGroupForm";
import { updateOptionGroupAction } from "@/app/admin/(dashboard)/menu/actions";
import { getOptionGroup, itemsUsingOptionGroup } from "@/lib/admin/store";

export const metadata = { title: "Edit extras group" };
export const dynamic = "force-dynamic";

export default async function EditOptionGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getOptionGroup(id);
  if (!group) notFound();

  const usedBy = await itemsUsingOptionGroup(id);

  return (
    <AdminShell title="Edit extras group">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/extras"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to extras
        </Link>

        {usedBy.length > 0 && (
          <p className="rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
            On {usedBy.length} dish{usedBy.length === 1 ? "" : "es"}:{" "}
            {usedBy.map((i) => i.name).join(", ")}. Changes here apply to all of
            them.
          </p>
        )}

        <OptionGroupForm
          group={group}
          action={updateOptionGroupAction}
          submitLabel="Save group"
        />
      </div>
    </AdminShell>
  );
}
