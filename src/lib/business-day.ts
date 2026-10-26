import { amsterdamLocalToUtc, amsterdamNow } from "@/lib/delivery-slots";
import { addDaysKey } from "@/lib/admin/report-range";
import { isSale, realOrders } from "@/lib/admin/order-analytics";
import { orderMoney } from "@/lib/admin/reports";
import type { AdminOrder, PaymentMethod } from "@/lib/admin/order-types";

/**
 * The business day: the stretch between two presses of **Close the day**, not a calendar day.
 *
 * The kitchen sometimes starts early and the last orders come in after midnight, so "the
 * orders of 26 October" is whatever happened between closing the 25th and closing the 26th —
 * and only a person knows when that was. Pure and isomorphic: the server uses it to build the
 * checklist and the summary, the reports screen uses `makeDayOf` to put each order on its day.
 *
 * The rules, in full:
 * - A closed day is a row (`business_days`, migration 0027): its label (`businessDate`), when it
 *   opened and when it was closed. Each day opens at the moment the previous one closed, so the
 *   days are back to back with no gaps.
 * - The **open day** runs from the last closing to now. Its label is the Amsterdam date on which
 *   it opened — but never the same label as the day before it: close at 23:30 on the 26th and
 *   the next day is the 27th, close at 01:30 on the 27th and it is also the 27th.
 * - **Before the very first closing** there is nothing to go on, so orders keep their calendar
 *   day, and the open day starts at midnight of the day you are working (a closing between
 *   midnight and 06:00 still belongs to the evening before — `SAME_NIGHT_HOURS`).
 */

/** A closing before this hour of the morning belongs to the night before. */
export const SAME_NIGHT_HOURS = 6;

export interface ClosedDay {
  businessDate: string;
  openedAt: string;
  closedAt: string;
}

export interface OpenDay {
  businessDate: string;
  openedAt: string;
  /** True before the first closing ever — the start is midnight, not a real closing. */
  firstEver: boolean;
}

/** The Amsterdam date of an instant. */
export function dateOfInstant(at: Date | string): string {
  return amsterdamNow(typeof at === "string" ? new Date(at) : at).dateKey;
}

/** Midnight at the start of an Amsterdam date, as an ISO instant. */
export function startOfDayIso(dateKey: string): string {
  return amsterdamLocalToUtc(dateKey, "00:00").toISOString();
}

/** The day that is open right now. `closed` must be oldest first. */
export function openDayFor(closed: ClosedDay[], now: Date = new Date()): OpenDay {
  const last = closed[closed.length - 1];
  if (!last) {
    const label = dateOfInstant(new Date(now.getTime() - SAME_NIGHT_HOURS * 3_600_000));
    return { businessDate: label, openedAt: startOfDayIso(label), firstEver: true };
  }
  const byClock = dateOfInstant(last.closedAt);
  const next = addDaysKey(last.businessDate, 1);
  return {
    businessDate: byClock > next ? byClock : next,
    openedAt: last.closedAt,
    firstEver: false,
  };
}

/**
 * Which business day an instant belongs to. Closed days first, then the open one; anything
 * before the first closed day keeps its Amsterdam calendar date.
 */
export function makeDayOf(closed: ClosedDay[], open: OpenDay): (iso: string) => string {
  const spans = closed
    .map((d) => ({ date: d.businessDate, from: Date.parse(d.openedAt), to: Date.parse(d.closedAt) }))
    .sort((a, b) => a.from - b.from);
  const openFrom = Date.parse(open.openedAt);

  return (iso: string) => {
    const t = Date.parse(iso);
    if (t >= openFrom) return open.businessDate;
    // Few rows (one a day), and the newest are the ones asked about most: search from the end.
    for (let i = spans.length - 1; i >= 0; i--) {
      const s = spans[i];
      if (t >= s.to) break;
      if (t >= s.from) return s.date;
    }
    return dateOfInstant(new Date(t));
  };
}

/** Orders placed inside the open day (or any window), oldest first. */
export function ordersBetween(orders: AdminOrder[], fromIso: string, toIso: string): AdminOrder[] {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return orders
    .filter((o) => {
      const t = Date.parse(o.placedAt);
      return t >= from && t < to;
    })
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
}

/* ------------------------------------------------------------------ checklist */

export interface CheckOrder {
  id: string;
  reference: string;
  customerName: string;
  status: AdminOrder["status"];
  paymentMethod: PaymentMethod;
  total: number;
}

export interface ChecklistItem {
  id: "waiting" | "inProgress" | "unpaid" | "rounds";
  /** Blocking items must be clear before the day can close; the rest are only shown. */
  blocking: boolean;
  ok: boolean;
  orders: CheckOrder[];
  /** Riders whose round was started and not finished (the `rounds` item only). */
  riders?: string[];
}

const toCheck = (o: AdminOrder): CheckOrder => ({
  id: o.id,
  reference: o.reference,
  customerName: o.customerName,
  status: o.status,
  paymentMethod: o.paymentMethod,
  total: o.total,
});

/**
 * What has to be done before a day can close.
 *
 * - **waiting** — a paid order nobody has accepted yet, whenever it was placed: it is live.
 * - **inProgress** — anything being cooked, waiting for a rider or on the road, plus an order
 *   scheduled for this day or earlier that hasn't been started. An order accepted for a *later*
 *   day is fine and not listed: it belongs to that day.
 * - **unpaid** — an order from this day still waiting for its money (a cash order delivered but
 *   not marked paid, a payment-link order nobody has confirmed, a customer still on the payment
 *   page). Cancelled ones don't count.
 * - **rounds** — a rider who started a round today and hasn't entered the end reading. Shown, not
 *   blocking: the mileage log must never stop the books being closed.
 */
export function dayChecklist(
  orders: AdminOrder[],
  open: OpenDay,
  now: Date,
  openRounds: string[] = []
): ChecklistItem[] {
  const waiting = orders.filter((o) => o.paymentStatus === "paid" && o.status === "new");
  const inProgress = orders.filter(
    (o) =>
      o.status === "preparing" ||
      o.status === "ready" ||
      o.status === "on_the_way" ||
      (o.status === "scheduled" && (!o.deliveryDate || o.deliveryDate <= open.businessDate))
  );
  const unpaid = ordersBetween(orders, open.openedAt, now.toISOString()).filter(
    (o) => o.paymentStatus === "open" && o.status !== "cancelled"
  );

  return [
    { id: "waiting", blocking: true, ok: waiting.length === 0, orders: waiting.map(toCheck) },
    { id: "inProgress", blocking: true, ok: inProgress.length === 0, orders: inProgress.map(toCheck) },
    { id: "unpaid", blocking: true, ok: unpaid.length === 0, orders: unpaid.map(toCheck) },
    { id: "rounds", blocking: false, ok: openRounds.length === 0, orders: [], riders: openRounds },
  ];
}

export function canClose(items: ChecklistItem[]): boolean {
  return items.every((item) => !item.blocking || item.ok);
}

/* ------------------------------------------------------------------ summary */

export interface DaySummary {
  orders: number;
  cancelled: number;
  revenue: number;
  foodSales: number;
  discounts: number;
  deliveryFees: number;
  refunds: number;
  /** Money taken per payment method (after refunds) — `cash` is what should be in the drawer. */
  byMethod: Record<PaymentMethod, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The day's figures, from the orders placed in it — what the audit is checked against. */
export function daySummary(dayOrders: AdminOrder[]): DaySummary {
  const real = realOrders(dayOrders);
  const sales = real.filter(isSale);
  const byMethod: Record<PaymentMethod, number> = {
    cash: 0,
    mollie: 0,
    payment_link: 0,
    bank_transfer: 0,
    unpaid: 0,
  };
  let foodSales = 0;
  let discounts = 0;
  let deliveryFees = 0;
  let refunds = 0;
  let revenue = 0;
  for (const o of sales) {
    const m = orderMoney(o);
    foodSales += m.foodNet;
    discounts += m.discount;
    deliveryFees += m.deliveryNet;
    refunds += m.refunded;
    revenue += o.total - o.refunded;
    byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] ?? 0) + o.total - o.refunded;
  }
  for (const key of Object.keys(byMethod) as PaymentMethod[]) byMethod[key] = round2(byMethod[key]);

  return {
    orders: sales.length,
    cancelled: real.filter((o) => o.status === "cancelled").length,
    revenue: round2(revenue),
    foodSales: round2(foodSales),
    discounts: round2(discounts),
    deliveryFees: round2(deliveryFees),
    refunds: round2(refunds),
    byMethod,
  };
}
