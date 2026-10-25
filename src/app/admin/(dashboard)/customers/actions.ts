"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/admin/guard";
import { deleteCustomerAccount, deleteOrders, guestOrderIds } from "@/lib/admin/deletion";
import { setContactSaved } from "@/lib/admin/customer-contacts";

/** Owner only, like deleting orders: this can erase an account and, optionally, its orders. */
const OWNER_ONLY = ["owner"] as const;
const CONFIRM_WORD = "DELETE";

function refresh() {
  for (const path of ["/admin", "/admin/customers", "/admin/orders", "/admin/orders/new", "/admin/orders/completed", "/admin/reports"]) {
    revalidatePath(path);
  }
}

/**
 * Delete a registered customer's account. Their orders are kept (and unlinked)
 * unless `alsoOrders` is set, in which case they are deleted too under the same
 * rules as any order deletion (typed confirmation if any of them was paid).
 */
export async function deleteCustomerAction(input: {
  id: string;
  alsoOrders: boolean;
  confirm?: string;
}): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_ONLY);
  try {
    const result = await deleteCustomerAccount(
      String(input?.id ?? ""),
      Boolean(input?.alsoOrders),
      input?.confirm === CONFIRM_WORD
    );
    if (!result.ok) return { ok: false, message: result.message };
    refresh();
    const base = result.ordersDeleted
      ? `Account deleted, along with ${result.ordersDeleted} order${result.ordersDeleted === 1 ? "" : "s"}.`
      : "Account deleted.";
    return { ok: true, message: [base, ...result.notes].join(" ") };
  } catch (error) {
    return { ok: false, message: `Couldn't delete: ${(error as Error).message}` };
  }
}

/**
 * A guest has no account to delete — they exist only as their orders — so
 * "deleting a guest" means deleting those orders. `key` is what follows
 * `guest:` in the customer id (an email, or `tel:<digits>`).
 */
export async function deleteGuestOrdersAction(input: {
  key: string;
  confirm?: string;
}): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_ONLY);
  const key = String(input?.key ?? "").trim().toLowerCase();
  if (!key) return { ok: false, message: "Unknown guest." };
  try {
    const ids = await guestOrderIds(key);
    if (ids.length === 0) return { ok: false, message: "That guest has no orders left." };
    // Sliced to the per-call cap; a guest with hundreds of orders is not expected.
    const result = await deleteOrders(ids.slice(0, 300), input?.confirm === CONFIRM_WORD);
    if (!result.ok) return { ok: false, message: result.message };
    refresh();
    return {
      ok: true,
      message: [`Deleted ${result.deleted} order${result.deleted === 1 ? "" : "s"}.`, ...result.notes].join(" "),
    };
  } catch (error) {
    return { ok: false, message: `Couldn't delete: ${(error as Error).message}` };
  }
}

/**
 * Tick (or untick) "I saved this customer's number in my phone". Harmless bookkeeping, so
 * owner, staff and managers can all use it. The key is the id the Customers screen shows —
 * an account uuid or `guest:<…>` — and is only ever used as a lookup string.
 */
export async function setContactSavedAction(
  key: string,
  saved: boolean
): Promise<{ ok: boolean; message: string }> {
  const session = await requireRole(["owner", "staff", "manager"]);
  const clean = String(key ?? "");
  if (!clean || clean.length > 320) return { ok: false, message: "Unknown customer." };

  const userId = /^[0-9a-f-]{36}$/i.test(session.user.id ?? "") ? session.user.id : null;
  const result = await setContactSaved(clean, Boolean(saved), userId);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_ready"
          ? "Run migration 0026 in Supabase first, then try again."
          : "Couldn't save that — try again.",
    };
  }
  revalidatePath("/admin/customers");
  return { ok: true, message: saved ? "Marked as saved in your phone." : "Marked as not saved." };
}
