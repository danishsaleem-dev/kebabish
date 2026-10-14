"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import ConfirmDialog, { Callout } from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { deleteOrdersAction, previewDeleteOrdersAction } from "@/app/admin/(dashboard)/orders/delete-actions";
import type { OrderDeletionPreview } from "@/lib/admin/deletion";
import { formatMoney } from "@/lib/admin/units";

type Loaded = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; preview: OrderDeletionPreview };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Delete these orders?" — asks the server what the selection actually contains
 * (how many are real paid sales, how many carry invoices, whether money is still
 * held) and says so before anything is removed. A selection that contains only
 * abandoned checkouts needs one click; anything paid needs the word DELETE typed.
 *
 * Owner-only (the actions enforce it; the pages only show the entry points to the
 * owner). Mount while open.
 */
export default function DeleteOrdersDialog({
  ids,
  onClose,
  onDeleted,
}: {
  ids: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [deleting, startDeleting] = useTransition();

  useEffect(() => {
    let live = true;
    previewDeleteOrdersAction(ids).then((result) => {
      if (!live) return;
      setLoaded(
        result.ok ? { state: "ready", preview: result.preview } : { state: "error", message: result.message }
      );
    });
    return () => {
      live = false;
    };
  }, [ids]);

  const preview = loaded.state === "ready" ? loaded.preview : null;
  const count = preview?.found ?? ids.length;

  function confirm(typed: string) {
    startDeleting(async () => {
      const result = await deleteOrdersAction({ ids, confirm: typed });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onDeleted();
    });
  }

  return (
    <ConfirmDialog
      title={`Delete ${plural(count, "order", "orders")} for good?`}
      confirmLabel={`Delete ${plural(count, "order", "orders")}`}
      busy={deleting}
      blocked={loaded.state !== "ready" || (preview?.found ?? 0) === 0}
      requireWord={preview && preview.sales > 0 ? "DELETE" : undefined}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {loaded.state === "loading" && <p className="text-muted">Checking what will be deleted…</p>}
      {loaded.state === "error" && <Callout tone="danger">{loaded.message}</Callout>}

      {preview && preview.found === 0 && <p>Those orders no longer exist.</p>}

      {preview && preview.found > 0 && (
        <>
          <p>
            This permanently removes {plural(preview.found, "order", "orders")} with {preview.found === 1 ? "its" : "their"} items
            and refunds. It can&apos;t be undone.
            {preview.unpaid > 0 && preview.sales > 0 && (
              <>
                {" "}
                {plural(preview.unpaid, "is an unpaid or abandoned checkout", "are unpaid or abandoned checkouts")}.
              </>
            )}
          </p>

          {preview.sales > 0 && (
            <Callout tone="danger">
              <p className="font-semibold">
                {plural(preview.sales, "of these is a paid order", "of these are paid orders")} ({formatMoney(preview.salesCents / 100)}
                {preview.invoiced > 0 ? `, ${plural(preview.invoiced, "invoice", "invoices")}` : ""}).
              </p>
              <p className="mt-1">
                Dutch bookkeeping rules require invoices to be kept for seven years, and invoice numbers should run without gaps.
                If this is test data, that&apos;s fine. If it&apos;s real,{" "}
                <Link href="/admin/settings/backup" className="font-semibold underline">
                  download a backup first
                </Link>
                .
              </p>
            </Callout>
          )}

          {preview.unrefundedOnlineCents > 0 && (
            <Callout tone="warn">
              <strong>{formatMoney(preview.unrefundedOnlineCents / 100)}</strong> was paid online and hasn&apos;t been refunded.
              Deleting an order does <strong>not</strong> give the customer their money back — refund it first (on the order
              page) if they should get it.
            </Callout>
          )}

          {preview.inFlight > 0 && (
            <Callout tone="warn">
              {plural(preview.inFlight, "order is", "orders are")} still being prepared or on the way — a customer may be
              waiting for {preview.inFlight === 1 ? "it" : "them"}.
            </Callout>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}
