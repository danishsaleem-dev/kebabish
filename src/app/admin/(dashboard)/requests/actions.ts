"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import {
  deleteStockRequest,
  setStockRequestStatus,
  type StockRequestStatus,
} from "@/lib/stock-requests/data";

export interface RequestActionResult {
  ok: boolean;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: StockRequestStatus[] = ["new", "contacted", "done", "declined"];

/** Mark a request new / contacted / done / declined. */
export async function setRequestStatusAction(id: string, status: string): Promise<RequestActionResult> {
  const session = await requireRole(OWNER_STAFF);
  if (!UUID.test(id) || !STATUSES.includes(status as StockRequestStatus)) {
    return { ok: false, message: "That isn't a valid request." };
  }
  const ok = await setStockRequestStatus(id, status as StockRequestStatus, session.user.id);
  if (!ok) return { ok: false, message: "Couldn't update it — try again." };
  revalidatePath("/admin/requests");
  return { ok: true };
}

/** Remove a request for good (a request that was handled, or a spam one). */
export async function deleteRequestAction(id: string): Promise<RequestActionResult> {
  await requireRole(OWNER_STAFF);
  if (!UUID.test(id)) return { ok: false, message: "That isn't a valid request." };
  if (!(await deleteStockRequest(id))) return { ok: false, message: "Couldn't delete it — try again." };
  revalidatePath("/admin/requests");
  return { ok: true };
}
