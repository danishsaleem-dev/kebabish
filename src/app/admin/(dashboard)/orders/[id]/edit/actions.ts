"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, OWNER_STAFF_MANAGER } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import { OrderEditError, applyOrderEdit, type EditInputLine } from "@/lib/admin/order-edit";

export interface OrderEditState {
  ok: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (cents: number) => `€ ${(cents / 100).toFixed(2)}`;

/** "12,50" / "12.5" -> cents; null when it isn't a usable amount. */
function eurosToCents(raw: unknown): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (text === "") return 0;
  const euros = Number(text);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

function parseLines(raw: unknown): EditInputLine[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((l) => {
      const line = l as Record<string, unknown>;
      return {
        from: typeof line.from === "number" ? line.from : null,
        mode: line.mode === "menu" ? "menu" : "keep",
        slug: typeof line.slug === "string" ? line.slug : null,
        quantity: Number(line.quantity),
        priceCents: Number(line.priceCents),
        options: Array.isArray(line.options)
          ? line.options.map((o) => ({
              groupId: String((o as Record<string, unknown>).groupId ?? ""),
              optionId: String((o as Record<string, unknown>).optionId ?? ""),
            }))
          : [],
        instructions: typeof line.instructions === "string" ? line.instructions : "",
        replaces: typeof line.replaces === "string" ? line.replaces : null,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Save changes to an order (see lib/admin/order-edit.ts for the rules). Owner, staff
 * and manager. Everything is validated and re-priced on the server; the form only
 * says which dishes and what to charge.
 */
export async function saveOrderEditAction(
  _prev: OrderEditState,
  formData: FormData
): Promise<OrderEditState> {
  const session = await requireRole(OWNER_STAFF_MANAGER);

  const orderId = String(formData.get("orderId") ?? "");
  if (!UUID.test(orderId)) return { ok: false, error: "That isn't a valid order." };

  const lines = parseLines(formData.get("lines"));
  if (!lines) return { ok: false, error: "The order lines couldn't be read — reload the page and try again." };

  const discountCents = eurosToCents(formData.get("discount"));
  const deliveryFeeCents = eurosToCents(formData.get("deliveryFee"));
  if (discountCents === null) return { ok: false, error: "Enter the discount as an amount like 2,50 — or leave it empty." };
  if (deliveryFeeCents === null) return { ok: false, error: "Enter the delivery fee as an amount like 2,50 — or leave it empty." };

  let result;
  try {
    result = await applyOrderEdit(
      orderId,
      {
        lines,
        discountCents,
        deliveryFeeCents,
        note: String(formData.get("note") ?? ""),
      },
      { id: session.user.id }
    );
  } catch (error) {
    if (error instanceof OrderEditError) return { ok: false, error: error.message };
    console.error("[order-edit] failed:", error);
    return { ok: false, error: "Couldn't save the changes — nothing was changed. Please try again." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/kitchen");
  revalidatePath("/rider");

  // Say what the change means for the money, in a line short enough for a toast.
  let message = `Order ${result.reference} updated. Total ${money(result.afterTotalCents)} (was ${money(result.beforeTotalCents)}).`;
  if (result.paid) {
    const diff = result.afterTotalCents - result.netPaidCents;
    if (diff > 0) message += ` ${money(diff)} still to collect.`;
    else if (diff < 0) message += ` ${money(-diff)} is due back — use Refund.`;
  }
  redirect(flashRedirect(`/admin/orders/${orderId}`, message));
}
