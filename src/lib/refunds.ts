import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/admin/store";
import { createRefund } from "@/lib/mollie";
import { vatIncludedCents } from "@/lib/money";
import { getOrderSummaryById } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email/order-status";
import { loadCreditNoteData } from "@/lib/invoice/data";
import { buildCreditNotePdf } from "@/lib/invoice/pdf";

/**
 * Refunds: full or partial, each with its own credit note.
 *
 * The order keeps a running `refunded_cents`; every refund is also a row in
 * `order_refunds` with its credit note number, the optional reason the customer
 * may see, and an internal note they may not. The original invoice is never
 * touched — corrections live on the credit notes.
 */

export interface RefundRecord {
  id: string;
  amountCents: number;
  creditNoteNumber: string;
  /** Null when a person handed the money back (cash / transfer orders). */
  molliePaid: boolean;
  reasonCustomer: string | null;
  noteInternal: string | null;
  createdAt: string;
  createdByName: string | null;
}

export type RefundResult =
  | {
      ok: true;
      refundedCents: number;
      creditNoteNumber: string;
      /** True when this refund used up the whole payment. */
      fullyRefunded: boolean;
    }
  | { ok: false; message: string };

export interface RefundInput {
  /** Omitted = refund everything still refundable. */
  amountCents?: number;
  /** Shown to the customer (on the credit note and in the email). Leave empty to show none. */
  reasonCustomer?: string;
  /** Staff-only. */
  noteInternal?: string;
  /** The staff member making the refund. */
  createdBy?: string | null;
}

/**
 * Give some or all of an order's money back.
 *
 * Several refunds may follow one another, so the guard is a compare-and-swap on
 * `refunded_cents` rather than a status flag: the update only succeeds if the
 * running total is still what we just read. Two staff pressing the button at
 * the same moment can't both get through and refund the same money twice; the
 * second sees a changed total and is told to look again. If Mollie then
 * refuses, the total is wound back so the owner can retry or deal with it in
 * Mollie's dashboard — it never claims money moved when it didn't.
 *
 * A cash or bank-transfer order has no Mollie payment: for those this only
 * *records* that a person handed the money back, and issues the credit note.
 */
export async function refundOrder(orderId: string, input: RefundInput = {}): Promise<RefundResult> {
  const supabase = supabaseAdmin();

  // Never move money we can't then record. If the refunds table isn't there
  // yet (migration 0014 not run), stop before touching Mollie at all.
  const probe = await supabase.from("order_refunds").select("id").limit(1);
  if (probe.error) {
    return {
      ok: false,
      message: "Refunds need a database update first (migration 0014). Nothing was refunded.",
    };
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("reference, payment_status, payment_method, mollie_payment_id, total_cents, refunded_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!order) return { ok: false, message: "Order not found." };
  if (order.payment_status !== "paid") {
    return { ok: false, message: "That order hasn't been paid, or it was already refunded in full." };
  }

  const remaining = order.total_cents - order.refunded_cents;
  const amount = input.amountCents ?? remaining;
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (amount > remaining) {
    return {
      ok: false,
      message: `Only €${(remaining / 100).toFixed(2)} is left to refund on this order.`,
    };
  }
  const viaMollie = order.payment_method === "mollie";
  if (viaMollie && !order.mollie_payment_id) {
    return { ok: false, message: "This order has no Mollie payment to refund." };
  }

  const fullyRefunded = amount === remaining;

  // Claim the amount. Succeeds only if nobody changed the total since we read it.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      refunded_cents: order.refunded_cents + amount,
      refunded_at: claimedAt,
      updated_at: claimedAt,
      ...(fullyRefunded ? { payment_status: "refunded" } : {}),
    })
    .eq("id", orderId)
    .eq("payment_status", "paid")
    .eq("refunded_cents", order.refunded_cents)
    .select("id");
  if (claimError) return { ok: false, message: claimError.message };
  if (!claimed || claimed.length === 0) {
    return { ok: false, message: "This order was just changed by someone else — reload it and check the refund history." };
  }

  const windBack = () =>
    supabase
      .from("orders")
      .update({
        refunded_cents: order.refunded_cents,
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

  let mollieRefundId: string | null = null;
  if (viaMollie) {
    try {
      const refund = await createRefund({
        paymentId: order.mollie_payment_id!,
        amountCents: amount,
        description: `Kebabish ${order.reference}`,
      });
      mollieRefundId = refund.id;
    } catch (refundError) {
      await windBack();
      return { ok: false, message: `Mollie couldn't refund it: ${(refundError as Error).message}` };
    }
  }

  // The VAT inside this refund, frozen now so the credit note never shifts if
  // the VAT setting is edited later.
  const settings = await getPublicSettings();
  const vatRate = settings.vatRatePercent ?? null;
  const vatCents = vatRate != null ? vatIncludedCents(amount, vatRate) : null;

  const { data: recorded, error: recordError } = await supabase.rpc("record_refund", {
    p_order: orderId,
    p_amount: amount,
    p_mollie_refund_id: mollieRefundId,
    p_reason: input.reasonCustomer?.trim() ?? "",
    p_note: input.noteInternal?.trim() ?? "",
    p_vat_rate: vatRate,
    p_vat_cents: vatCents,
    p_created_by: input.createdBy ?? null,
  });
  const row = Array.isArray(recorded) ? recorded[0] : recorded;
  if (recordError || !row) {
    // The money has moved (or the order was counted as refunded) but the record
    // failed. Don't wind anything back — that would make the books lie the other
    // way. Say so loudly so it gets reconciled by hand.
    console.error(
      `[refunds] REFUND MADE BUT NOT RECORDED for ${order.reference}: €${(amount / 100).toFixed(2)}`,
      mollieRefundId ?? "(no Mollie refund)",
      recordError
    );
    return {
      ok: false,
      message: `The refund of €${(amount / 100).toFixed(2)} went through${mollieRefundId ? ` (Mollie ${mollieRefundId})` : ""} but its credit note could not be saved. Tell the developer — the order total is already updated.`,
    };
  }

  return {
    ok: true,
    refundedCents: amount,
    creditNoteNumber: row.credit_note_number as string,
    fullyRefunded,
  };
}

/** Every refund on an order, oldest first, with the staff member's name. */
export async function listRefunds(orderId: string): Promise<RefundRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("order_refunds")
    .select("id, amount_cents, credit_note_number, mollie_refund_id, reason_customer, note_internal, created_by, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) {
    // Until migration 0014 is run there is no such table. The order page must
    // still open, so this reads as "no refunds yet" rather than an error.
    console.warn("[refunds] could not read refunds:", error.message);
    return [];
  }

  const ids = [...new Set((data ?? []).map((r) => r.created_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await supabase.from("admin_users").select("id, name").in("id", ids);
    for (const u of users ?? []) names.set(u.id, u.name);
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    amountCents: r.amount_cents,
    creditNoteNumber: r.credit_note_number,
    molliePaid: Boolean(r.mollie_refund_id),
    reasonCustomer: r.reason_customer,
    noteInternal: r.note_internal,
    createdAt: r.created_at,
    createdByName: r.created_by ? (names.get(r.created_by) ?? null) : null,
  }));
}

/** Customer-facing view: number, amount and date only — never the internal note. */
export async function listCreditNotesForCustomer(
  orderId: string
): Promise<{ number: string; amountCents: number; createdAt: string }[]> {
  const { data, error } = await supabaseAdmin()
    .from("order_refunds")
    .select("credit_note_number, amount_cents, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[refunds] could not read credit notes:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    number: r.credit_note_number,
    amountCents: r.amount_cents,
    createdAt: r.created_at,
  }));
}

/**
 * Tell the customer about a refund: the email (with the credit note PDF
 * attached) and, if staff gave one, the reason. `kind` says which email to
 * send — "cancelled" when the refund is part of declining an order,
 * "refunded" when it was made on its own. Never throws; a failed email must
 * not undo a refund that already happened.
 */
export async function notifyRefund(
  orderId: string,
  result: Extract<RefundResult, { ok: true }>,
  kind: "cancelled" | "refunded",
  reasonCustomer?: string
): Promise<void> {
  try {
    const order = await getOrderSummaryById(orderId);
    if (!order) return;

    let creditNote: { number: string; pdf: Buffer } | undefined;
    try {
      const data = await loadCreditNoteData(order.reference, result.creditNoteNumber);
      if (data) {
        creditNote = {
          number: result.creditNoteNumber,
          pdf: Buffer.from(await buildCreditNotePdf(data)),
        };
      }
    } catch (error) {
      console.error("[refunds] could not build the credit note PDF:", error);
    }

    after(() =>
      sendOrderStatusEmail(order, kind, result.refundedCents, {
        reason: reasonCustomer?.trim() || undefined,
        creditNote,
        partial: !result.fullyRefunded,
      })
    );
  } catch (error) {
    console.error("[refunds] could not send the refund email:", error);
  }
}
