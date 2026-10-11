"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getOrderSummaryById, markOrderPaid, refundOrder } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email/order-status";
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

  let result;
  try {
    result = await cancelOrder(orderId, { role });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  if (result.refundError) {
    // The order is cancelled either way — say plainly that the money is not
    // back with the customer yet, instead of a green tick.
    return {
      ok: true,
      message: `Cancelled, but the refund failed: ${result.refundError} Refund it from the order page or in Mollie.`,
    };
  }
  if (result.refundNote) {
    return { ok: true, message: `Cancelled. ${result.refundNote}` };
  }
  return {
    ok: true,
    message: result.refundedCents > 0 ? "Cancelled and refunded in full." : undefined,
  };
}

/**
 * Manual full refund from the order page — for after the fact (a wrong or
 * unsatisfactory order) rather than a decline, which refunds by itself.
 * Owner/staff only: it moves money.
 */
export async function refundOrderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff") {
    return { ok: false, message: "Only the owner or staff can refund an order." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const result = await refundOrder(orderId);
  if (!result.ok) return { ok: false, message: result.message };

  const order = await getOrderSummaryById(orderId);
  if (order) after(() => sendOrderStatusEmail(order, "refunded", result.refundedCents));

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Refunded in full." };
}

/**
 * "The cash was handed over" / "the transfer arrived" — for orders staff
 * entered by hand. Online (Mollie) orders can't be marked paid by a person;
 * `markOrderPaid` refuses them.
 */
export async function markOrderPaidAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Sign in again to do that." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  let done: boolean;
  try {
    done = await markOrderPaid(orderId);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  if (!done) {
    return { ok: false, message: "That order can't be marked paid — it's already paid, or it's an online payment." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/rider");
  return { ok: true, message: "Marked as paid." };
}
