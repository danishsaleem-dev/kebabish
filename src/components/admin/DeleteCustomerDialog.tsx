"use client";

import { useState, useTransition } from "react";
import ConfirmDialog, { Callout } from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { deleteCustomerAction, deleteGuestOrdersAction } from "@/app/admin/(dashboard)/customers/actions";

export type CustomerTarget =
  | { kind: "registered"; id: string; name: string; orderCount: number }
  /** `key` is what follows `guest:` in the Customers list id (an email or `tel:<digits>`). */
  | { kind: "guest"; key: string; name: string; orderCount: number };

const orders = (n: number) => `${n} order${n === 1 ? "" : "s"}`;

/**
 * Deleting a person from Customers.
 *
 * A **registered** customer has an account: deleting it removes the sign-in, the
 * saved address and the marketing-consent record. Their orders are the shop's
 * records, so by default they are kept (and keep their own copy of the name and
 * address); ticking the box deletes them as well.
 *
 * A **guest** has no account — they exist only as their orders — so deleting one
 * means deleting those orders.
 *
 * Whenever orders go with it the word DELETE has to be typed: this dialog can't see
 * whether any were paid (the server can, and refuses without it regardless).
 * Owner only; the actions enforce it. Mount while open.
 */
export default function DeleteCustomerDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: CustomerTarget;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [alsoOrders, setAlsoOrders] = useState(false);
  const [busy, startBusy] = useTransition();

  const removesOrders = target.kind === "guest" || alsoOrders;

  function confirm(typed: string) {
    startBusy(async () => {
      const result =
        target.kind === "guest"
          ? await deleteGuestOrdersAction({ key: target.key, confirm: typed })
          : await deleteCustomerAction({ id: target.id, alsoOrders, confirm: typed });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onDeleted();
    });
  }

  return (
    <ConfirmDialog
      title={
        target.kind === "guest"
          ? `Delete ${orders(target.orderCount)} from ${target.name}?`
          : `Delete ${target.name}'s account?`
      }
      confirmLabel={target.kind === "guest" ? "Delete their orders" : alsoOrders ? "Delete account and orders" : "Delete account"}
      busy={busy}
      requireWord={removesOrders ? "DELETE" : undefined}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {target.kind === "guest" ? (
        <>
          <p>
            {target.name} checked out as a guest, so there is no account to delete — they exist only as their{" "}
            {orders(target.orderCount)}. This permanently deletes {target.orderCount === 1 ? "it" : "them"}, with the items and
            any refunds.
          </p>
          <OrdersWarning />
        </>
      ) : (
        <>
          <p>
            This permanently removes their sign-in, saved delivery address and marketing-consent record. They can create a new
            account whenever they like.
          </p>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-hairline p-3">
            <input
              type="checkbox"
              checked={alsoOrders}
              onChange={(e) => setAlsoOrders(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-hairline accent-danger"
            />
            <span>
              <span className="font-semibold text-heading">Also delete their {orders(target.orderCount)}</span>
              <span className="mt-0.5 block text-muted">
                {alsoOrders
                  ? "Everything this customer ever ordered is erased."
                  : "Not ticked: their orders are kept (the shop's records) and will show under Customers as a guest."}
              </span>
            </span>
          </label>

          {alsoOrders && <OrdersWarning />}
        </>
      )}
    </ConfirmDialog>
  );
}

function OrdersWarning() {
  return (
    <Callout tone="danger">
      Paid orders have invoices, which Dutch bookkeeping rules require you to keep for seven years — and deleting an order does
      not refund the customer. If this is real customer data, download a backup first (Settings → Backup).
    </Callout>
  );
}
