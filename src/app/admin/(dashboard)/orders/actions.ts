"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { updateOrderStatus, assignRider } from "@/lib/admin/orders-data";
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
  if (!user || (role !== "owner" && role !== "staff" && role !== "rider")) {
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

/** Owner/staff only — riders don't assign themselves. */
export async function assignRiderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  if (session?.user.role !== "owner" && session?.user.role !== "staff") {
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
