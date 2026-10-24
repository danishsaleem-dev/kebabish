import { amsterdamNow } from "@/lib/delivery-slots";
import { CHANNEL_LABELS } from "@/lib/admin/order-types";
import { isSale, realOrders } from "@/lib/admin/order-analytics";
import type { ReportBucket, ReportRange } from "@/lib/admin/report-range";
import type { AdminOrder } from "@/lib/admin/order-types";
import type { RiderShift } from "@/lib/rider-shifts";

/**
 * Every figure the Reports screen shows, as pure functions over an already-fetched order list.
 * No Supabase here: the page fetches once, server-side, and the screen recomputes on every
 * change of range or granularity in the browser.
 *
 * **Days are Amsterdam days.** `order-analytics.ts` buckets by the server's local calendar,
 * which is fine when the bucket is "one of the last twelve months". It is not fine here: the
 * reader picks 25 October on a calendar and expects the orders the kitchen took on 25 October,
 * not what a UTC server would call that day.
 *
 * What counts as a sale is unchanged — `realOrders` (paid, including later refunded) narrowed
 * by `isSale` (paid and not cancelled), with revenue net of refunds. Per-line figures (dishes,
 * categories) stay at their original amounts, because a partial refund isn't tied to a line.
 */

export interface RangeSummary {
  revenue: number;
  orders: number;
  items: number;
  /** Distinct customers, matched on email, else phone, else the order itself. */
  customers: number;
  averageOrder: number;
}

export interface NamedValue {
  label: string;
  value: number;
}

/** The Amsterdam calendar day an order was placed on. */
export function orderDayKey(order: AdminOrder): string {
  return amsterdamNow(new Date(order.placedAt)).dateKey;
}

/** The Amsterdam calendar day an order was delivered on, or null if it never was. */
export function deliveredDayKey(order: AdminOrder): string | null {
  if (order.status !== "delivered") return null;
  return order.deliveredAt ? amsterdamNow(new Date(order.deliveredAt)).dateKey : order.deliveryDate;
}

/** Real orders placed inside the range, oldest first. */
export function ordersInRange(orders: AdminOrder[], range: ReportRange): AdminOrder[] {
  return realOrders(orders)
    .filter((o) => {
      const day = orderDayKey(o);
      return day >= range.from && day <= range.to;
    })
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
}

function who(order: AdminOrder): string {
  return order.customerId ?? order.customerEmail?.toLowerCase() ?? order.phone ?? order.id;
}

export function summarise(orders: AdminOrder[]): RangeSummary {
  const sales = orders.filter(isSale);
  const revenue = sales.reduce((total, o) => total + o.total - o.refunded, 0);
  const items = sales.reduce(
    (total, o) => total + o.lines.reduce((n, line) => n + line.quantity, 0),
    0
  );
  return {
    revenue: round2(revenue),
    orders: sales.length,
    items,
    customers: new Set(sales.map(who)).size,
    averageOrder: sales.length ? round2(revenue / sales.length) : 0,
  };
}

export type SeriesMetric = "revenue" | "orders" | "items";

/** One number per bucket, for the trend chart. */
export function seriesFor(
  orders: AdminOrder[],
  buckets: ReportBucket[],
  metric: SeriesMetric
): number[] {
  const byDay = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    const day = orderDayKey(order);
    const list = byDay.get(day);
    if (list) list.push(order);
    else byDay.set(day, [order]);
  }

  return buckets.map((bucket) => {
    let total = 0;
    for (const [day, list] of byDay) {
      if (day < bucket.from || day > bucket.to) continue;
      for (const order of list) {
        if (!isSale(order)) continue;
        if (metric === "revenue") total += order.total - order.refunded;
        else if (metric === "orders") total += 1;
        else total += order.lines.reduce((n, line) => n + line.quantity, 0);
      }
    }
    return round2(total);
  });
}

/* --------------------------------------------------------------- breakdowns */

export interface DishRow {
  name: string;
  slug: string;
  category: string;
  quantity: number;
  revenue: number;
  /** How many separate orders contained it — not the same as portions sold. */
  orders: number;
}

export function byDish(orders: AdminOrder[], categoryByDish: Map<string, string>): DishRow[] {
  const rows = new Map<string, DishRow>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    const seen = new Set<string>();
    for (const line of order.lines) {
      const row = rows.get(line.slug) ?? {
        name: line.baseName,
        slug: line.slug,
        category: categoryByDish.get(line.slug) ?? "Other",
        quantity: 0,
        revenue: 0,
        orders: 0,
      };
      row.quantity += line.quantity;
      row.revenue += line.unitPrice * line.quantity;
      if (!seen.has(line.slug)) {
        row.orders += 1;
        seen.add(line.slug);
      }
      rows.set(line.slug, row);
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue) }))
    .sort((a, b) => b.quantity - a.quantity);
}

export interface CategoryRow {
  label: string;
  quantity: number;
  revenue: number;
  /** Share of the range's line revenue, as a whole percent. */
  share: number;
}

export function byCategory(
  orders: AdminOrder[],
  categoryByDish: Map<string, string>
): CategoryRow[] {
  const rows = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    for (const line of order.lines) {
      const label = categoryByDish.get(line.slug) ?? "Other";
      const row = rows.get(label) ?? { quantity: 0, revenue: 0 };
      row.quantity += line.quantity;
      row.revenue += line.unitPrice * line.quantity;
      rows.set(label, row);
    }
  }
  const total = [...rows.values()].reduce((sum, r) => sum + r.revenue, 0);
  return [...rows.entries()]
    .map(([label, r]) => ({
      label,
      quantity: r.quantity,
      revenue: round2(r.revenue),
      share: total ? Math.round((r.revenue / total) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface CustomerRow {
  name: string;
  contact: string;
  orders: number;
  items: number;
  revenue: number;
  lastOrder: string;
  /** False for a guest checkout — no account behind it. */
  registered: boolean;
}

/**
 * Who ordered in this range. Grouped the same way the Customers screen groups guests — by
 * account first, then email, then phone — so the two screens never disagree about whether two
 * orders were the same person.
 */
export function byCustomer(orders: AdminOrder[]): CustomerRow[] {
  const rows = new Map<string, CustomerRow>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    const key = who(order);
    const row = rows.get(key) ?? {
      name: order.customerName,
      contact: order.customerEmail || order.phone || "—",
      orders: 0,
      items: 0,
      revenue: 0,
      lastOrder: order.placedAt,
      registered: Boolean(order.customerId),
    };
    row.orders += 1;
    row.items += order.lines.reduce((n, line) => n + line.quantity, 0);
    row.revenue += order.total - order.refunded;
    if (Date.parse(order.placedAt) > Date.parse(row.lastOrder)) row.lastOrder = order.placedAt;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface RiderRow {
  riderId: string | null;
  name: string;
  /** Orders delivered in the range — by the day they were delivered, not placed. */
  deliveries: number;
  revenue: number;
  /** Odometer kilometres logged over the range, null when nothing was logged. */
  km: number | null;
  /** Rounds with both readings in. */
  rounds: number;
}

/**
 * Riders, by what they actually delivered on each day of the range — a delivery belongs to the
 * day it went out, not the day the order was placed, or a Friday order delivered on Saturday
 * would land in the wrong week.
 *
 * Kilometres come from the rider's own odometer readings (`rider-shifts.ts`); a rider who
 * hasn't logged any shows `null`, which the screen prints as "—" rather than a misleading 0.
 */
export function byRider(
  orders: AdminOrder[],
  range: ReportRange,
  shifts: RiderShift[] = []
): RiderRow[] {
  const rows = new Map<string, RiderRow>();
  const keyFor = (id: string | null) => id ?? "unassigned";

  for (const order of realOrders(orders)) {
    const day = deliveredDayKey(order);
    if (!day || day < range.from || day > range.to) continue;
    const key = keyFor(order.assignedRiderId);
    const row = rows.get(key) ?? {
      riderId: order.assignedRiderId,
      name: order.assignedRiderName ?? "Not assigned",
      deliveries: 0,
      revenue: 0,
      km: null,
      rounds: 0,
    };
    row.deliveries += 1;
    row.revenue += order.total - order.refunded;
    rows.set(key, row);
  }

  for (const shift of shifts) {
    if (shift.shiftDate < range.from || shift.shiftDate > range.to) continue;
    if (shift.drivenKm === null) continue;
    const key = keyFor(shift.riderId);
    const row = rows.get(key) ?? {
      riderId: shift.riderId,
      name: shift.riderName ?? "Rider",
      deliveries: 0,
      revenue: 0,
      km: null,
      rounds: 0,
    };
    row.km = (row.km ?? 0) + shift.drivenKm;
    row.rounds += 1;
    if (shift.riderName) row.name = shift.riderName;
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), km: r.km === null ? null : round1(r.km) }))
    .sort((a, b) => b.deliveries - a.deliveries);
}

/**
 * Orders by hour of the Amsterdam day. The axis spans only the hours that actually saw an
 * order, widened to at least 11:00–22:00 so the shape of a quiet range still reads as a
 * service day rather than two lonely bars.
 */
export function byHour(orders: AdminOrder[]): NamedValue[] {
  const counts = new Map<number, number>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    // amsterdamNow already resolves the Amsterdam wall clock; minutes-since-midnight / 60 is the hour.
    const hour = Math.floor(amsterdamNow(new Date(order.placedAt)).minutes / 60);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  const used = [...counts.keys()];
  const first = Math.min(11, ...used);
  const last = Math.max(22, ...used);
  const out: NamedValue[] = [];
  for (let h = first; h <= last; h++) {
    out.push({ label: `${String(h).padStart(2, "0")}:00`, value: counts.get(h) ?? 0 });
  }
  return out;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Orders by weekday, Monday first — which days are worth staffing. */
export function byWeekday(orders: AdminOrder[]): NamedValue[] {
  const counts = new Array(7).fill(0);
  for (const order of orders) {
    if (!isSale(order)) continue;
    // amsterdamNow gives 0=Sunday; shift so Monday is 0.
    const weekday = (amsterdamNow(new Date(order.placedAt)).weekday + 6) % 7;
    counts[weekday] += 1;
  }
  return WEEKDAY_NAMES.map((label, i) => ({ label, value: counts[i] }));
}

/** Delivery orders by town — a pickup order didn't go anywhere. */
export function byTown(orders: AdminOrder[]): NamedValue[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.fulfilment !== "delivery" || !isSale(order)) continue;
    counts.set(order.town, (counts.get(order.town) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Where the orders came from. Only channels with orders in the range are listed. */
export function byChannel(orders: AdminOrder[]): NamedValue[] {
  const counts = new Map<AdminOrder["channel"], number>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    counts.set(order.channel, (counts.get(order.channel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([channel, value]) => ({ label: CHANNEL_LABELS[channel], value }))
    .sort((a, b) => b.value - a.value);
}

/** Percentage change, with "no previous figure" reading as 0% rather than infinity. */
export function delta(now: number, before: number): number {
  if (before === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - before) / before) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
