"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import DeleteCustomerDialog from "@/components/admin/DeleteCustomerDialog";

/** The "Delete account" button on a registered customer's own page (owner only). */
export default function DeleteCustomerControl({
  id,
  name,
  orderCount,
}: {
  id: string;
  name: string;
  orderCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
      >
        <Trash2 size={16} />
        Delete account
      </button>

      {open && (
        <DeleteCustomerDialog
          target={{ kind: "registered", id, name, orderCount }}
          onClose={() => setOpen(false)}
          onDeleted={() => {
            setOpen(false);
            router.replace("/admin/customers");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
