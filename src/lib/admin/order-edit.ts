import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { toCents } from "@/lib/money";
import { fetchLineExtras, type LineExtra } from "@/lib/order-extras";
import type { StoreShape } from "@/lib/admin/store/types";
import { isFutureDelivery } from "@/lib/admin/order-types";
import { resyncOrderStock } from "@/lib/stock";
import { releaseDeliverySlot, reserveDeliverySlot } from "@/lib/delivery-slots-data";
import {
  DEFAULT_SLOT_MINUTES,
  amsterdamNow,
  effectiveHours,
  generateDaySlots,
  weekdayForDateKey,
} from "@/lib/delivery-slots";

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
  /** A new delivery day and time, when staff changed it. */
  schedule?: ScheduleRequest;
}

/** What the form says about when the order goes out. */
export interface ScheduleRequest {
  /** "YYYY-MM-DD". Empty = leave the delivery time alone. */
  date: string;
  /** "HH:MM|HH:MM" — a slot offered that day. */
  slot: string;
  /** "HH:MM" — an exact time, used when no slot is picked. */
  time: string;
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
  "id, reference, status, payment_status, payment_method, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, refunded_cents, delivery_date, delivery_slot_start, delivery_slot_end";

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
  /** When it is due: a calendar day (Amsterdam) and the window, if it has one. */
  deliveryDate: string | null;
  deliverySlotStart: string | null;
  deliverySlotEnd: string | null;
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
    deliveryDate: order.delivery_date ?? null,
    deliverySlotStart: order.delivery_slot_start ?? null,
    deliverySlotEnd: order.delivery_slot_end ?? null,
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

/* ------------------------------------------------------------ the delivery day and time */

type DayLike = { closed: boolean; opens: string; closes: string; slotMinutes?: number } | undefined;

export interface ScheduleChange {
  date: string;
  start: string;
  end: string;
  /** A real slot was picked, so a seat has to be taken in it (capacity is enforced). */
  reserve: boolean;
  /** The old time was a real slot, so its seat goes back into the pool. */
  releaseOld: boolean;
  /** One line for the order's history: "Delivery moved from … to …". */
  text: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function describeWhen(date: string, start: string | null, end: string | null): string {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return start ? `${day} ${start}${end ? `–${end}` : ""}` : day;
}

/**
 * Work out what a change of delivery day/time means — or null when nothing changed. Pure:
 * the caller supplies today's date and the opening hours of the old and new day.
 *
 * Staff may use any slot that exists that day (the customer-facing cutoff is not applied —
 * they can fit someone into a slot that is already running, as with a manual order), or an
 * exact time, which books nothing. A day that has already passed is refused: this order
 * hasn't been delivered yet, so that would just be a typo.
 */
export function planSchedule(
  current: { date: string | null; start: string | null; end: string | null },
  request: ScheduleRequest | undefined,
  ctx: { today: string; newDay: DayLike; oldDay: DayLike }
): ScheduleChange | null {
  if (!request || !request.date) return null;
  const date = request.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new OrderEditError("That isn't a valid delivery date.");
  }

  // Nothing moved (same day, same start): leave it alone — before any other check, so an order
  // that is already overdue, or has an exact off-grid time, can still have its dishes edited.
  const requestedStart = request.slot ? request.slot.split("|")[0] : request.time;
  if (requestedStart && current.date === date && current.start === requestedStart) return null;

  if (date < ctx.today) {
    throw new OrderEditError("Choose today or a later day — this order hasn't been delivered yet.");
  }

  let start: string;
  let end: string;
  let reserve = false;

  if (request.slot) {
    const [s, e] = request.slot.split("|");
    const offered = ctx.newDay ? generateDaySlots(ctx.newDay).some((w) => w.start === s && w.end === e) : false;
    if (!offered) throw new OrderEditError("That slot isn't offered on that day.");
    start = s;
    end = e;
    reserve = true;
  } else if (request.time) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.time)) throw new OrderEditError("Enter the time like 18:30.");
    const [h, m] = request.time.split(":").map(Number);
    const length = ctx.newDay?.slotMinutes ?? DEFAULT_SLOT_MINUTES;
    const endMinutes = Math.min(h * 60 + m + length, 24 * 60 - 1);
    start = request.time;
    end = `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`;
  } else {
    throw new OrderEditError("Pick a slot for that day, or enter an exact time.");
  }

  const wasSlot =
    current.date && current.start && ctx.oldDay
      ? generateDaySlots(ctx.oldDay).some((w) => w.start === current.start)
      : false;
  const before = current.date ? describeWhen(current.date, current.start, current.end) : "no set time";

  return {
    date,
    start,
    end,
    reserve,
    releaseOld: Boolean(wasSlot),
    text: `Delivery moved from ${before} to ${describeWhen(date, start, end)}.`,
  };
}

export interface EditResult {
  reference: string;
  beforeTotalCents: number;
  afterTotalCents: number;
  /** Cents the customer has actually paid and not had back (0 for an unpaid order). */
  netPaidCents: number;
  paid: boolean;
  /** Set when the delivery day/time was changed. */
  scheduleText: string | null;
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

  const { built, subtotal, discount, fee, total, note: lineNote } = planEdit(input, oldRows, oldExtras, store);

  // ---- the delivery day and time, if staff changed them -------------------------------
  const hours = effectiveHours(store.settings);
  const dayFor = (date: string | null) => (date ? hours.find((h) => h.day === weekdayForDateKey(date)) : undefined);
  const schedule = planSchedule(
    { date: order.delivery_date ?? null, start: order.delivery_slot_start ?? null, end: order.delivery_slot_end ?? null },
    input.schedule,
    {
      today: amsterdamNow().dateKey,
      newDay: dayFor(input.schedule?.date || null),
      oldDay: dayFor(order.delivery_date ?? null),
    }
  );
  // An order whose payment failed or lapsed already gave its seat back; don't take or return one.
  const holdsSeat = !["failed", "expired", "cancelled"].includes(order.payment_status);
  // Accepted and being prepared, but now due on a later day: it goes back to "scheduled" so
  // nobody cooks it early. (Needs migration 0020; without it the status is simply left alone.)
  const newStatus =
    schedule && order.status === "preparing" && isFutureDelivery(schedule.date) ? "scheduled" : null;
  // The change is written into the history line so "Changes to this order" says what moved.
  const note = [schedule?.text, lineNote].filter(Boolean).join(" — ").slice(0, 500);

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

  let reservedNew = false;
  const undo = async (newIds: string[]) => {
    if (newIds.length) await db.from("order_items").delete().in("id", newIds);
    await db.from("order_edits").delete().eq("id", editRow.id);
    if (reservedNew && schedule) await releaseDeliverySlot(schedule.date, schedule.start);
  };

  // Take the seat in the new slot first: if it is full, nothing else has been touched yet.
  if (schedule?.reserve && holdsSeat) {
    let ok = false;
    try {
      ok = await reserveDeliverySlot(schedule.date, weekdayForDateKey(schedule.date), schedule.start);
    } catch (err) {
      await undo([]);
      throw err;
    }
    if (!ok) {
      await undo([]);
      throw new OrderEditError("That slot is full or switched off — pick another slot, or enter an exact time.");
    }
    reservedNew = true;
  }

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

  const patch: Record<string, unknown> = {
    subtotal_cents: subtotal,
    discount_cents: discount,
    delivery_fee_cents: fee,
    total_cents: total,
    updated_at: new Date().toISOString(),
    ...(schedule
      ? { delivery_date: schedule.date, delivery_slot_start: schedule.start, delivery_slot_end: schedule.end }
      : {}),
  };
  let { error: updateError } = await db
    .from("orders")
    .update(newStatus ? { ...patch, status: newStatus } : patch)
    .eq("id", orderId);
  if (updateError && newStatus && updateError.code === "23514") {
    // The database doesn't know "scheduled" yet (migration 0020): save everything else.
    console.error("[order-edit] status 'scheduled' refused — run migration 0020. Leaving the status as it was.");
    ({ error: updateError } = await db.from("orders").update(patch).eq("id", orderId));
  }
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
        delivery_date: order.delivery_date,
        delivery_slot_start: order.delivery_slot_start,
        delivery_slot_end: order.delivery_slot_end,
        status: order.status,
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

  // The dishes changed: give the old lines back to stock and take the new ones (only if the
  // order had taken its stock already).
  await resyncOrderStock(orderId);

  // The old slot has its seat back (best effort — a failure here is logged, never thrown).
  if (schedule?.releaseOld && holdsSeat) {
    await releaseDeliverySlot(order.delivery_date ?? null, order.delivery_slot_start ?? null);
  }

  const settled = order.payment_status === "paid" || order.payment_status === "refunded";
  return {
    reference: order.reference,
    beforeTotalCents: order.total_cents,
    afterTotalCents: total,
    netPaidCents: settled ? Math.max(order.total_cents - (order.refunded_cents ?? 0), 0) : 0,
    paid: settled,
    scheduleText: schedule?.text ?? null,
  };
}
