"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { updateOrderStatus, assignRider, cancelOrder } from "@/lib/admin/orders-data";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-types";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/** Shared by the admin order-detail page and the rider dashboard. */
export async function updateOrderStatusAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;
  if (
    !user ||
    (role !== "owner" && role !== "staff" && role !== "manager" && role !== "rider")
  ) {
    return { ok: false, message: "Sign in again to do that." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "") as OrderStatus;

  try {
    await updateOrderStatus(orderId, nextStatus, { id: user.id, role });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/rider");
  return { ok: true, message: `Marked as ${ORDER_STATUS_LABELS[nextStatus]}.` };
}

/** Owner/staff/manager only — riders don't assign themselves. */
export async function assignRiderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Only staff can assign a rider." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const riderId = String(formData.get("riderId") ?? "");

  try {
    await assignRider(orderId, riderId || null);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/rider");
  return { ok: true, message: riderId ? "Rider assigned." : "Rider unassigned." };
}

export interface SimpleActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Accept/decline, called directly (not via useActionState/FormData) by the
 * new-order popup, which polls for pending orders rather than living on a
 * `<form>`. Accept is just the "new -> preparing" step everything else
 * already goes through; decline cancels the order outright, which is a
 * kitchen-only call the same way accepting is.
 */
export async function acceptOrderAction(orderId: string): Promise<SimpleActionResult> {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;
  if (!user || (role !== "owner" && role !== "staff" && role !== "manager")) {
    return { ok: false, message: "Sign in again to do that." };
  }

  try {
    await updateOrderStatus(orderId, "preparing", { id: user.id, role });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function declineOrderAction(orderId: string): Promise<SimpleActionResult> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Sign in again to do that." };
  }

  try {
    await cancelOrder(orderId, { role });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
