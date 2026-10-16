"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assignRider, updateOrderStatus } from "@/lib/admin/orders-data";

export interface KitchenActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Accept an order (new -> preparing) or mark it ready (preparing -> ready).
 * Those are the only two moves the kitchen has; `updateOrderStatus` enforces
 * that for the kitchen role itself, so this stays safe even if someone calls
 * the action directly rather than through the board.
 */
export async function advanceKitchenOrderAction(
  orderId: string,
  to: "preparing" | "ready"
): Promise<KitchenActionResult> {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;
  if (!user || (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager")) {
    return { ok: false, message: "Sign in again to do that." };
  }
  if (to !== "preparing" && to !== "ready") {
    return { ok: false, message: "Not allowed." };
  }

  try {
    await updateOrderStatus(orderId, to, { id: user.id, role });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/admin/orders");
  return { ok: true };
}

/**
 * The kitchen hands an order to a rider (or takes the rider off it). Same
 * people who can use the board; a rider id that isn't a rider is refused.
 */
export async function assignKitchenRiderAction(
  orderId: string,
  riderId: string | null
): Promise<KitchenActionResult> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Sign in again to do that." };
  }

  try {
    await assignRider(orderId, riderId || null);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/rider");
  return { ok: true };
}
