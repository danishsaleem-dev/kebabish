"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import DeleteOrdersDialog from "@/components/admin/DeleteOrdersDialog";

/**
 * The "Delete order" button on an order's own page (owner only — the page decides
 * whether to render it, and the action behind it checks the role again). On
 * success the order no longer exists, so it goes back to the list.
 */
export default function DeleteOrderControl({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
      >
        <Trash2 size={16} />
        Delete order
      </button>

      {open && (
        <DeleteOrdersDialog
          ids={[orderId]}
          onClose={() => setOpen(false)}
          onDeleted={() => {
            setOpen(false);
            router.replace("/admin/orders");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
