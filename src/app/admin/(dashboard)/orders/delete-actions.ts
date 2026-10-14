"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/admin/guard";
import {
  deleteOrders,
  previewOrderDeletion,
  validIds,
  type OrderDeletionPreview,
} from "@/lib/admin/deletion";

/**
 * Permanently deleting orders is **owner only**. Staff can cancel and refund, which
 * leaves a record; erasing the record itself (and, for a paid order, an invoice
 * Dutch bookkeeping rules want kept for seven years) is the owner's call. Like every
 * server action this re-checks the role: the page guard protects the page, not the
 * POST endpoint.
 */
const OWNER_ONLY = ["owner"] as const;

/** The literal word the owner types to confirm deleting a real sale. */
const CONFIRM_WORD = "DELETE";

function refresh() {
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/orders/new",
    "/admin/orders/completed",
    "/admin/customers",
    "/admin/reports",
    "/admin/feedback",
    "/admin/settings/delivery-slots",
  ]) {
    revalidatePath(path);
  }
}

export async function previewDeleteOrdersAction(
  ids: string[]
): Promise<{ ok: true; preview: OrderDeletionPreview } | { ok: false; message: string }> {
  await requireRole(OWNER_ONLY);
  const clean = validIds(ids);
  if (!clean) return { ok: false, message: "Choose between 1 and 300 orders." };
  try {
    return { ok: true, preview: await previewOrderDeletion(clean) };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function deleteOrdersAction(input: {
  ids: string[];
  /** The text typed into the confirmation box. Only required when a paid order is included. */
  confirm?: string;
}): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_ONLY);
  try {
    const result = await deleteOrders(input?.ids, input?.confirm === CONFIRM_WORD);
    if (!result.ok) return { ok: false, message: result.message };
    refresh();
    const base = `Deleted ${result.deleted} order${result.deleted === 1 ? "" : "s"}.`;
    return { ok: true, message: [base, ...result.notes].join(" ") };
  } catch (error) {
    return { ok: false, message: `Couldn't delete: ${(error as Error).message}` };
  }
}
