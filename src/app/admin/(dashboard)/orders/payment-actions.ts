"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { readStore } from "@/lib/admin/store";
import {
  amsterdamNow,
  effectiveHours,
  generateDaySlots,
  weekdayForDateKey,
} from "@/lib/delivery-slots";
import { listSlotConfigForDate, type AdminSlotRow } from "@/lib/delivery-slots-data";
import { sendPaymentReopenedEmail } from "@/lib/email/payment-reopened";
import { orderPaymentUrl } from "@/lib/order-payment-url";
import { getOrderForRetry, getOrderSummaryById, setOrderDeliveryWindow } from "@/lib/orders";
import { REOPEN_HOURS, RETRYABLE_PAYMENT } from "@/lib/payment-window";
import { savePaymentReopen } from "@/lib/payment-reopen";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

async function staffId(): Promise<string | null> {
  const user = (await auth())?.user;
  const role = user?.role;
  return user && (role === "owner" || role === "staff" || role === "manager") ? user.id : null;
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Has this window already ended, on Amsterdam's clock? */
function hasEnded(date: string, end: string): boolean {
  const now = amsterdamNow();
  const [h, m] = end.split(":").map(Number);
  return date < now.dateKey || (date === now.dateKey && now.minutes >= h * 60 + m);
}

/** A day's delivery windows with how full they are. Windows already over are left out. */
export async function reopenSlotsAction(date: string): Promise<AdminSlotRow[]> {
  if (!(await staffId()) || !isDate(date)) return [];
  const rows = await listSlotConfigForDate(date, weekdayForDateKey(date));
  return rows.filter((r) => !hasEnded(date, r.end));
}

/**
 * Let the customer pay an unpaid order again: choose how long, and the delivery time.
 * Nothing is charged or reserved here — the seat is taken when they press pay.
 */
export async function reopenPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await staffId();
  if (!actor) return { ok: false, message: "Sign in again to do that." };

  const orderId = String(formData.get("orderId") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const hours = Number(formData.get("hours"));
  const [date = "", start = "", end = ""] = String(formData.get("slot") ?? "").split("|");

  const order = await getOrderForRetry(reference);
  if (!order || order.id !== orderId) return { ok: false, message: "That order no longer exists." };
  if (order.paymentMethod !== "mollie" && order.paymentMethod !== "payment_link") {
    return { ok: false, message: "Only online payments can be reopened." };
  }
  if (order.status === "cancelled") return { ok: false, message: "This order is cancelled." };
  if (order.paymentStatus === "open") {
    return {
      ok: false,
      message: "A payment is still in progress. Try again once it has expired (about 15 minutes).",
    };
  }
  if (!RETRYABLE_PAYMENT.includes(order.paymentStatus)) {
    return { ok: false, message: "This order doesn't need a new payment." };
  }
  if (!(REOPEN_HOURS as readonly number[]).includes(hours)) {
    return { ok: false, message: "Choose how long the link should work." };
  }
  if (!isDate(date) || !isTime(start) || !isTime(end)) {
    return { ok: false, message: "Choose a delivery time." };
  }
  if (hasEnded(date, end)) {
    return { ok: false, message: "That delivery time is already over — choose a later one." };
  }

  const changed = date !== order.deliveryDate || start !== order.deliverySlotStart;
  const rows = await listSlotConfigForDate(date, weekdayForDateKey(date));
  const row = rows.find((r) => r.start === start);
  if (changed) {
    const settings = (await readStore()).settings;
    const day = effectiveHours(settings).find((h) => h.day === weekdayForDateKey(date));
    if (!day || !generateDaySlots(day).some((s) => s.start === start && s.end === end)) {
      return { ok: false, message: "That slot isn't offered on that day." };
    }
  }
  if (row && (!row.enabled || row.bookedCount >= row.maxOrders)) {
    return { ok: false, message: "That slot is full or switched off — choose another." };
  }

  const openUntil = new Date(Date.now() + hours * 3_600_000).toISOString();
  try {
    const saved = await savePaymentReopen(
      order.id,
      { openUntil, deliveryDate: date, slotStart: start },
      actor
    );
    if (!saved) {
      return {
        ok: false,
        message:
          "Reopening isn't set up yet — run supabase/migrations/0033_payment_reopen.sql in the Supabase SQL editor first.",
      };
    }
    if (changed) await setOrderDeliveryWindow(order.id, { date, start, end });
  } catch (error) {
    console.error("[orders] could not reopen the payment:", error);
    return { ok: false, message: "Couldn't reopen the payment. Please try again." };
  }

  const summary = await getOrderSummaryById(order.id);
  const emailed = summary
    ? await sendPaymentReopenedEmail(summary, {
        url: orderPaymentUrl(summary.reference, summary.locale),
        openUntil,
      })
    : false;

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return {
    ok: true,
    message: emailed
      ? "Payment reopened and the link emailed to the customer."
      : "Payment reopened. No email was sent — send the link yourself.",
  };
}
