import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { toCents } from "@/lib/money";
import { fetchLineExtras, type LineExtra } from "@/lib/order-extras";
import type { StoreShape } from "@/lib/admin/store/types";

/**
 * Editing an order after it was placed — a dish turned out to be unavailable, or
 * something else went wrong, and after a call with the customer staff swap in
 * something else or change what is charged.
 *
 * **Compensation** is the case this is built around: the customer ordered €20 of
 * food, it isn't available, and a €25 dish goes out instead for the same €20. The line
 * is *charged* at €20 but remembers its regular price (€25) and what it replaced, so the
 * bill can show the €5 the customer was given. That is `order_line_extra`; the previous
 * state of the order is kept in `order_edits`.
 *
 * Everything is **re-derived on the server** from the real menu, like a manual order: the
 * form says which dish and what to charge, never what a dish costs, and a chosen extra
 * must really belong to that dish. What staff may do that a customer can't: use a dish
 * that is sold out, ignore a required choice, and set any price (including 0).
 *
 * Rules:
 *  - Only an order still to be delivered can be edited (not delivered, not cancelled),
 *    and not one waiting for an automatic online payment — the Mollie payment already
 *    started is for the old amount, and changing the total under it would let the
 *    customer pay the wrong sum.
 *  - Changing the total of an order that was already paid does **not** move any money
 *    by itself: the result says what is now owed or due back, and the order page's
 *    Refund box does the actual refund (with its credit note).
 *  - An invoice already issued for the order is not rewritten silently: the invoice
 *    PDF is built from the order, so it will show the edited lines under the same
 *    number — the page warns before saving, and the earlier emailed copy stays as it was.
 */

export class OrderEditError extends Error {}

export interface EditInputLine {
  /** Index of the existing line this keeps or replaces; null for a dish added new. */
  from: number | null;
  mode: "keep" | "menu";
  /** For `menu`: the dish. */
  slug: string | null;
  quantity: number;
  /** What is charged for one portion, extras included. */
  priceCents: number;
  /** For `menu`: the extras chosen. */
  options: { groupId: string; optionId: string }[];
  /** For `menu`: a note for this dish. */
  instructions: string;
  /** For `menu`: the name of what it replaces. */
  replaces: string | null;
}

export interface EditInput {
  lines: EditInputLine[];
  discountCents: number;
  deliveryFeeCents: number;
  note: string;
}

interface Option {
  groupLabel: string;
  optionLabel: string;
  priceCents: number;
}

export interface ItemRow {
  id: string;
  item_slug: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  options: Option[] | null;
  instructions: string | null;
  line_total_cents: number;
}

const ORDER_COLUMNS =
  "id, reference, status, payment_status, payment_method, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, refunded_cents";

const extrasCents = (options: Option[] | null) => (options ?? []).reduce((n, o) => n + o.priceCents, 0);

/* ------------------------------------------------------------- what the form needs */

export interface EditableLine {
  index: number;
  slug: string;
  name: string;
  quantity: number;
  /** What the customer is charged for one portion, extras included. */
  chargedCents: number;
  extras: string[];
  instructions: string;
  /** The regular price, when this line is already a compensation. */
  listUnitPriceCents: number | null;
  replaces: string | null;
}

export interface EditableOrder {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  refundedCents: number;
  invoiced: boolean;
  lines: EditableLine[];
}

/** Why an order can't be edited, or null if it can. */
export function editBlockedReason(order: {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
}): string | null {
  if (order.status === "delivered") return "This order has been delivered, so it can't be changed.";
  if (order.status === "cancelled") return "This order was cancelled, so it can't be changed.";
  if (order.paymentMethod === "mollie" && order.paymentStatus === "open") {
    return "This order is waiting for its online payment, which was started for the current amount. Wait until it is paid, or cancel it and create a new order.";
  }
  return null;
}

export async function loadOrderForEdit(orderId: string): Promise<EditableOrder | null> {
  const db = supabaseAdmin();
  const { data: order, error } = await db.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const [{ data: items, error: itemsError }, extras, invoice] = await Promise.all([
    db
      .from("order_items")
      .select("id, item_slug, name, quantity, unit_price_cents, options, instructions, line_total_cents")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    fetchLineExtras(orderId),
    db.from("orders").select("invoice_number").eq("id", orderId).maybeSingle(),
  ]);
  if (itemsError) throw new Error(itemsError.message);

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method ?? "mollie",
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents ?? 0,
    deliveryFeeCents: order.delivery_fee_cents,
    totalCents: order.total_cents,
    refundedCents: order.refunded_cents ?? 0,
    invoiced: Boolean(invoice.data?.invoice_number),
    lines: ((items ?? []) as ItemRow[]).map((row, index) => ({
      index,
      slug: row.item_slug,
      name: row.name,
      quantity: row.quantity,
      chargedCents: row.unit_price_cents + extrasCents(row.options),
      extras: (row.options ?? []).map((o) => o.optionLabel),
      instructions: row.instructions ?? "",
      listUnitPriceCents: extras.get(row.id)?.listUnitPriceCents ?? null,
      replaces: extras.get(row.id)?.replaces ?? null,
    })),
  };
}

/* ------------------------------------------------------------------- saving it */

interface NewLine {
  row: Omit<ItemRow, "id">;
  listUnitPriceCents: number | null;
  replaces: string | null;
}

/**
 * The pricing half of an edit, with no database in it: given what the form sent, the
 * order's existing lines (and any compensation notes they already carry) and the real
 * menu, work out the new lines and totals — or throw `OrderEditError`. Exported so the
 * rules (what a swap is charged, when a compensation is recorded) can be tested directly.
 */
export function planEdit(
  input: EditInput,
  oldRows: ItemRow[],
  oldExtras: Map<string, LineExtra>,
  store: Pick<StoreShape, "items" | "optionGroups">
) {

  // ---- rebuild every line from what the form says plus the real menu -----------
  if (input.lines.length === 0) throw new OrderEditError("An order needs at least one dish.");
  if (input.lines.length > 40) throw new OrderEditError("That's too many lines for one order.");

  const built: NewLine[] = [];

  for (const line of input.lines) {
    const quantity = Math.min(Math.max(Math.trunc(line.quantity), 1), 50);
    if (!Number.isFinite(line.priceCents) || line.priceCents < 0 || line.priceCents > 100_000) {
      throw new OrderEditError("A price is out of range.");
    }
    const charged = Math.round(line.priceCents);

    if (line.mode === "keep") {
      const old = line.from != null ? oldRows[line.from] : undefined;
      if (!old) throw new OrderEditError("A line in the form no longer matches the order — reload the page.");
      const previous = oldExtras.get(old.id);
      const originalCharged = old.unit_price_cents + extrasCents(old.options);

      if (charged === originalCharged) {
        // Price untouched: the line stays exactly as it was (extras priced as before).
        built.push({
          row: {
            item_slug: old.item_slug,
            name: old.name,
            quantity,
            unit_price_cents: old.unit_price_cents,
            options: old.options,
            instructions: old.instructions,
            line_total_cents: charged * quantity,
          },
          listUnitPriceCents: previous?.listUnitPriceCents ?? null,
          replaces: previous?.replaces ?? null,
        });
      } else {
        // Price changed: the line is charged this amount all in (extras stay listed, free),
        // and the regular price is remembered when it is more than what is charged.
        const regular = previous?.listUnitPriceCents ?? originalCharged;
        built.push({
          row: {
            item_slug: old.item_slug,
            name: old.name,
            quantity,
            unit_price_cents: charged,
            options: (old.options ?? []).map((o) => ({ ...o, priceCents: 0 })),
            instructions: old.instructions,
            line_total_cents: charged * quantity,
          },
          listUnitPriceCents: regular > charged ? regular : null,
          replaces: previous?.replaces ?? null,
        });
      }
      continue;
    }

    // A dish picked from the menu: a replacement, or something added.
    const item = store.items.find((i) => i.slug === line.slug);
    if (!item) throw new OrderEditError("One of those dishes isn't on the menu any more.");

    const options: Option[] = [];
    for (const chosen of line.options) {
      if (!item.optionGroupIds?.includes(chosen.groupId)) {
        throw new OrderEditError(`"${item.name}" doesn't offer one of the extras that was chosen.`);
      }
      const group = store.optionGroups?.find((g) => g.id === chosen.groupId);
      const option = group?.options.find((o) => o.id === chosen.optionId);
      if (!group || !option) throw new OrderEditError(`One of the extras for "${item.name}" no longer exists.`);
      options.push({ groupLabel: group.label, optionLabel: option.label, priceCents: toCents(option.price) });
    }

    const menuUnit = item.price != null ? toCents(item.price) : charged;
    const regular = menuUnit + extrasCents(options);
    const atMenuPrice = charged === regular;

    built.push({
      row: {
        item_slug: item.slug,
        name: item.name,
        quantity,
        unit_price_cents: atMenuPrice ? menuUnit : charged,
        options: atMenuPrice ? options : options.map((o) => ({ ...o, priceCents: 0 })),
        instructions: line.instructions.trim().slice(0, 300) || null,
        line_total_cents: charged * quantity,
      },
      listUnitPriceCents: regular > charged ? regular : null,
      replaces: line.replaces?.trim().slice(0, 120) || null,
    });
  }

  // ---- totals ---------------------------------------------------------------
  const subtotal = built.reduce((n, l) => n + l.row.line_total_cents, 0);
  const discount = Math.min(Math.max(Math.round(input.discountCents), 0), subtotal);
  const fee = Math.min(Math.max(Math.round(input.deliveryFeeCents), 0), 10_000);
  const total = subtotal - discount + fee;
  const note = input.note.trim().slice(0, 500);

  return { built, subtotal, discount, fee, total, note };
}

export interface EditResult {
  reference: string;
  beforeTotalCents: number;
  afterTotalCents: number;
  /** Cents the customer has actually paid and not had back (0 for an unpaid order). */
  netPaidCents: number;
  paid: boolean;
}

export async function applyOrderEdit(
  orderId: string,
  input: EditInput,
  actor: { id: string }
): Promise<EditResult> {
  const db = supabaseAdmin();

  const { data: order, error } = await db.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new OrderEditError("That order no longer exists.");

  const blocked = editBlockedReason({
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method ?? "mollie",
  });
  if (blocked) throw new OrderEditError(blocked);

  // The tables the edit is recorded in must be there, or there'd be no history and
  // no compensation note — better to refuse than to edit silently.
  const probe = await db.from("order_edits").select("id").limit(1);
  if (probe.error) {
    throw new OrderEditError(
      "Order editing isn't set up yet — run supabase/migrations/0021_requests_and_order_edits.sql in the Supabase SQL editor first."
    );
  }

  const { data: existing, error: itemsError } = await db
    .from("order_items")
    .select("id, item_slug, name, quantity, unit_price_cents, options, instructions, line_total_cents")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
      .order("id", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  const oldRows = (existing ?? []) as ItemRow[];
  const oldExtras = await fetchLineExtras(orderId);

  const store = await readStore();

  const { built, subtotal, discount, fee, total, note } = planEdit(input, oldRows, oldExtras, store);

  // ---- write: new lines first, so a failure can still be undone --------------------
  const snapshot = oldRows.map((r) => ({
    name: r.name,
    quantity: r.quantity,
    unitPriceCents: r.unit_price_cents + extrasCents(r.options),
    options: r.options ?? [],
    instructions: r.instructions,
  }));

  const { data: editRow, error: editError } = await db
    .from("order_edits")
    .insert({
      order_id: orderId,
      edited_by: actor.id,
      note,
      before_lines: snapshot,
      before_total_cents: order.total_cents,
      after_total_cents: total,
    })
    .select("id")
    .single();
  if (editError) throw new Error(editError.message);

  const undo = async (newIds: string[]) => {
    if (newIds.length) await db.from("order_items").delete().in("id", newIds);
    await db.from("order_edits").delete().eq("id", editRow.id);
  };

  const { data: inserted, error: insertError } = await db
    .from("order_items")
    // Each line gets its own timestamp so they keep the order staff put them in.
    .insert(built.map((l, i) => ({ order_id: orderId, ...l.row, created_at: new Date(Date.now() + i).toISOString() })))
    .select("id");
  if (insertError || !inserted || inserted.length !== built.length) {
    await undo((inserted ?? []).map((r) => r.id as string));
    throw new Error(insertError?.message ?? "Couldn't save the new lines.");
  }
  const newIds = inserted.map((r) => r.id as string);

  const { error: updateError } = await db
    .from("orders")
    .update({
      subtotal_cents: subtotal,
      discount_cents: discount,
      delivery_fee_cents: fee,
      total_cents: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (updateError) {
    await undo(newIds);
    throw new Error(updateError.message);
  }

  const { error: deleteError } = await db
    .from("order_items")
    .delete()
    .in(
      "id",
      oldRows.map((r) => r.id)
    );
  if (deleteError) {
    // Put the order back as it was rather than leave old and new lines side by side.
    await db
      .from("orders")
      .update({
        subtotal_cents: order.subtotal_cents,
        discount_cents: order.discount_cents,
        delivery_fee_cents: order.delivery_fee_cents,
        total_cents: order.total_cents,
      })
      .eq("id", orderId);
    await undo(newIds);
    throw new Error(deleteError.message);
  }

  const extraRows = built.flatMap((l, i) =>
    l.listUnitPriceCents != null || l.replaces
      ? [
          {
            order_item_id: newIds[i],
            order_id: orderId,
            list_unit_price_cents: l.listUnitPriceCents,
            replaces: l.replaces,
          },
        ]
      : []
  );
  if (extraRows.length) {
    const { error: extraError } = await db.from("order_line_extra").insert(extraRows);
    if (extraError) {
      console.error("[order-edit] the order was changed but its compensation notes were not saved:", extraError.message);
      throw new OrderEditError(
        "The order was changed, but the compensation notes couldn't be saved — open the order and check the lines."
      );
    }
  }

  const settled = order.payment_status === "paid" || order.payment_status === "refunded";
  return {
    reference: order.reference,
    beforeTotalCents: order.total_cents,
    afterTotalCents: total,
    netPaidCents: settled ? Math.max(order.total_cents - (order.refunded_cents ?? 0), 0) : 0,
    paid: settled,
  };
}
