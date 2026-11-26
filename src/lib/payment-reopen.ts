import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { PaymentReopen } from "@/lib/payment-window";

/**
 * The staff reopening of an unpaid order (`order_payment_reopens`, migration 0033).
 * Reading never fails a page: without the table nothing has been reopened.
 */
export async function getPaymentReopen(orderId: string): Promise<PaymentReopen | null> {
  const { data, error } = await supabaseAdmin()
    .from("order_payment_reopens")
    .select("open_until, delivery_date, delivery_slot_start")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    console.error("[payment-reopen] could not read (run migration 0033?):", error.message);
    return null;
  }
  if (!data) return null;
  return {
    openUntil: data.open_until,
    deliveryDate: data.delivery_date,
    slotStart: data.delivery_slot_start,
  };
}

/** False when the table isn't there yet; any other failure throws. */
export async function savePaymentReopen(
  orderId: string,
  reopen: PaymentReopen,
  openedBy: string
): Promise<boolean> {
  const { error } = await supabaseAdmin().from("order_payment_reopens").upsert(
    {
      order_id: orderId,
      open_until: reopen.openUntil,
      delivery_date: reopen.deliveryDate,
      delivery_slot_start: reopen.slotStart,
      opened_by: openedBy,
      opened_at: new Date().toISOString(),
    },
    { onConflict: "order_id" }
  );
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  throw new Error(error.message);
}
