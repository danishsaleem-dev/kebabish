import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { releaseDeliverySlot } from "@/lib/delivery-slots-data";
import { releaseOrderStock } from "@/lib/stock";

/**
 * Permanently deleting orders and customers.
 *
 * Deliberately a separate, small module with the rules written down, because
 * deleting an order is not like deleting a dish:
 *
 *  - **A paid order has an invoice.** Dutch bookkeeping rules want invoices kept
 *    for seven years and numbered without gaps. So anything paid (or refunded, or
 *    already carrying an invoice number) needs an explicit typed confirmation, and
 *    the dialog says why. Unpaid / abandoned / cancelled-before-payment orders
 *    are just checkouts that never became a sale and go with one confirm.
 *  - **Deleting does not refund.** An online (Mollie) payment that was never
 *    refunded is money the shop is holding. The preview counts it so the owner
 *    sees it before confirming.
 *  - **A live order is not a record, it's a customer waiting.** Paid and not yet
 *    delivered/cancelled is flagged as in flight.
 *  - **Never reuse an invoice number.** Deleting the newest invoices does NOT wind
 *    the counter back (an emailed PDF carrying that number may exist). The one
 *    exception is when *no* invoice for that year remains at all: then there is
 *    nothing to collide with and numbering starts again at 000001 — which is exactly
 *    the "reset the invoice counter before launch" step in CLAUDE.md. Same for
 *    credit notes.
 *
 * Callers (server actions) have already checked the role; this only does the work.
 */

const MAX_ORDERS_PER_CALL = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payment states in which the order has already given its delivery slot back
 * (a failed, expired or cancelled payment releases it when that is recorded —
 * see `syncPaymentStatus`). An unpaid-but-open checkout still holds its slot.
 */
const SLOT_ALREADY_RELEASED = new Set(["failed", "expired", "canceled"]);

interface Row {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_cents: number;
  refunded_cents: number;
  invoice_number: string | null;
  delivery_date: string | null;
  delivery_slot_start: string | null;
}

const COLUMNS =
  "id, reference, status, payment_status, payment_method, total_cents, refunded_cents, invoice_number, delivery_date, delivery_slot_start";

/** A real sale: paid, refunded afterwards, or already invoiced. */
function isSale(r: Row): boolean {
  return r.invoice_number !== null || r.payment_status === "paid" || r.payment_status === "refunded";
}

export interface OrderDeletionPreview {
  /** Orders found (ids that don't exist are ignored). */
  found: number;
  /** Checkouts that never became a sale. */
  unpaid: number;
  /** Real sales: paid, refunded or invoiced. These need the typed confirmation. */
  sales: number;
  /** Of those, ones carrying an invoice number. */
  invoiced: number;
  /** Paid and not yet delivered or cancelled: a customer may be waiting. */
  inFlight: number;
  /** Paid online and not fully refunded: money the shop still holds. */
  unrefundedOnlineCents: number;
  /** Total value of the sales being deleted. */
  salesCents: number;
}

export function validIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const clean = [...new Set(ids.filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  if (clean.length === 0 || clean.length > MAX_ORDERS_PER_CALL) return null;
  return clean;
}

async function fetchRows(ids: string[]): Promise<Row[]> {
  const { data, error } = await supabaseAdmin().from("orders").select(COLUMNS).in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function previewOrderDeletion(ids: string[]): Promise<OrderDeletionPreview> {
  const rows = await fetchRows(ids);
  const sales = rows.filter(isSale);
  return {
    found: rows.length,
    unpaid: rows.length - sales.length,
    sales: sales.length,
    invoiced: rows.filter((r) => r.invoice_number !== null).length,
    inFlight: sales.filter(
      (r) => r.payment_status === "paid" && r.status !== "delivered" && r.status !== "cancelled"
    ).length,
    unrefundedOnlineCents: sales
      .filter((r) => r.payment_status === "paid" && r.payment_method === "mollie")
      .reduce((sum, r) => sum + Math.max(0, r.total_cents - r.refunded_cents), 0),
    salesCents: sales.reduce((sum, r) => sum + r.total_cents, 0),
  };
}

export type DeleteOrdersResult =
  | {
      ok: true;
      deleted: number;
      /** Plain-language notes for the toast: numbering restarted, gaps left, etc. */
      notes: string[];
    }
  | { ok: false; message: string };

function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

const yearOf = (number: string, prefix: "INV" | "CN"): number | null => {
  const m = new RegExp(`^${prefix}-(\\d{4})-`).exec(number);
  return m ? Number(m[1]) : null;
};

/**
 * Delete the given orders for good (their lines and refunds go with them; any
 * feedback just loses its link to the order). `confirmed` must be true when any
 * of them is a real sale.
 */
export async function deleteOrders(rawIds: unknown, confirmed: boolean): Promise<DeleteOrdersResult> {
  const ids = validIds(rawIds);
  if (!ids) return { ok: false, message: `Choose between 1 and ${MAX_ORDERS_PER_CALL} orders.` };

  const rows = await fetchRows(ids);
  if (rows.length === 0) return { ok: false, message: "Those orders no longer exist." };

  const sales = rows.filter(isSale);
  if (sales.length > 0 && !confirmed) {
    return {
      ok: false,
      message: `${sales.length} of these ${sales.length === 1 ? "is a paid order" : "are paid orders"} — type DELETE to confirm.`,
    };
  }

  const db = supabaseAdmin();

  // What the numbering needs, read BEFORE the rows are gone.
  const invoiceYears = new Set<number>();
  for (const r of rows) {
    const year = r.invoice_number ? yearOf(r.invoice_number, "INV") : null;
    if (year) invoiceYears.add(year);
  }
  const { data: refundRows, error: refundError } = await db
    .from("order_refunds")
    .select("credit_note_number")
    .in("order_id", rows.map((r) => r.id));
  if (refundError) throw new Error(refundError.message);
  const creditYears = new Set<number>();
  for (const r of refundRows ?? []) {
    const year = yearOf(String(r.credit_note_number), "CN");
    if (year) creditYears.add(year);
  }

  // Give back any delivery slot still being held, so a deleted order doesn't go
  // on shrinking that slot's capacity. Only for orders that actually held one:
  // not cancelled, not a payment that already failed (those released it then),
  // and not in the past (nothing left to free).
  const today = todayAmsterdam();
  for (const r of rows) {
    const heldSlot =
      r.status !== "cancelled" &&
      !SLOT_ALREADY_RELEASED.has(r.payment_status) &&
      r.delivery_date !== null &&
      r.delivery_date >= today;
    if (heldSlot) await releaseDeliverySlot(r.delivery_date, r.delivery_slot_start);
  }

  // Portions a deleted order still held go back into stock (not for delivered ones — that food
  // was eaten — and a no-op for an order that never took any).
  for (const r of rows) {
    if (r.status !== "delivered") await releaseOrderStock(r.id);
  }

  const { error } = await db.from("orders").delete().in("id", rows.map((r) => r.id));
  if (error) throw new Error(error.message);

  const notes: string[] = [];

  // Numbering: only ever restart from zero when nothing is left for that year.
  for (const year of invoiceYears) {
    const { count, error: countError } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .like("invoice_number", `INV-${year}-%`);
    if (countError) continue;
    if ((count ?? 0) === 0) {
      await db.from("invoice_counters").delete().eq("year", year);
      notes.push(`No ${year} invoices remain, so invoice numbering starts again at 000001.`);
    } else {
      notes.push(`Deleted invoices leave gaps in the ${year} numbering; the next invoice continues from the highest number ever used.`);
    }
  }
  for (const year of creditYears) {
    const { count, error: countError } = await db
      .from("order_refunds")
      .select("id", { count: "exact", head: true })
      .like("credit_note_number", `CN-${year}-%`);
    if (countError) continue;
    if ((count ?? 0) === 0) await db.from("credit_note_counters").delete().eq("year", year);
  }

  return { ok: true, deleted: rows.length, notes };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type DeleteCustomerResult =
  | { ok: true; ordersDeleted: number; notes: string[] }
  | { ok: false; message: string };

/**
 * Delete a registered customer's account (sign-in, saved address, marketing
 * consent). Their orders are kept by default — they are the shop's records, and
 * an order already carries its own copy of the name and address — and simply
 * lose the link to the account. With `alsoOrders` they are deleted too, under
 * the same rules as any order deletion.
 */
export async function deleteCustomerAccount(
  id: string,
  alsoOrders: boolean,
  confirmed: boolean
): Promise<DeleteCustomerResult> {
  if (!UUID.test(id)) return { ok: false, message: "Unknown customer." };
  const db = supabaseAdmin();

  const { data: customer, error } = await db.from("customers").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return { ok: false, message: "That customer no longer exists." };

  let ordersDeleted = 0;
  const notes: string[] = [];
  if (alsoOrders) {
    const { data: orders, error: ordersError } = await db.from("orders").select("id").eq("customer_id", id);
    if (ordersError) throw new Error(ordersError.message);
    const orderIds = (orders ?? []).map((o) => o.id as string);
    // Done in slices: deleteOrders caps how many it takes at once.
    for (let i = 0; i < orderIds.length; i += MAX_ORDERS_PER_CALL) {
      const result = await deleteOrders(orderIds.slice(i, i + MAX_ORDERS_PER_CALL), confirmed);
      if (!result.ok) return result;
      ordersDeleted += result.deleted;
      notes.push(...result.notes);
    }
  }

  const { error: deleteError } = await db.from("customers").delete().eq("id", id);
  if (deleteError) throw new Error(deleteError.message);

  if (!alsoOrders) {
    notes.push("Their orders were kept and now show under Customers as a guest.");
  }
  return { ok: true, ordersDeleted, notes: [...new Set(notes)] };
}

/** Order ids belonging to a guest (no account), by the same grouping the Customers list uses. */
export async function guestOrderIds(key: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("id, customer_email, customer_phone")
    .is("customer_id", null);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((o) => {
      const email = String(o.customer_email ?? "").trim().toLowerCase();
      const k = email || `tel:${String(o.customer_phone ?? "").replace(/\D/g, "")}`;
      return k === key;
    })
    .map((o) => o.id as string);
}
