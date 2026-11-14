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
 * by `isSale` (paid and not cancelled), with revenue net of refunds.
 *
 * **Every money figure is what was really taken**, never a menu price: per-dish and per-category
 * sales come from the order's own lines (what was charged, incl. a price staff typed in), less
 * that order's share of its discount (coupon + manual discount) and of any refund. See
 * `orderMoney`.
 */

export interface RangeSummary {
  /** Everything taken: food after discounts + delivery fees, less refunds. */
  revenue: number;
  /** Food only, after discounts and refunds — what the dishes really brought in. */
  foodSales: number;
  /** Food at the prices charged per line, before any discount. */
  foodBeforeDiscounts: number;
  /** Coupons and manual discounts given. */
  discounts: number;
  deliveryFees: number;
  refunds: number;
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

/**
 * Which day an instant belongs to. By default the Amsterdam calendar day; the reports screen
 * passes the **business-day** version (`makeDayOf` in `business-day.ts`), so an order taken
 * at 00:40 lands on the day that was still open — the one the kitchen closed afterwards.
 */
export type DayOf = (iso: string) => string;

export const calendarDayOf: DayOf = (iso) => amsterdamNow(new Date(iso)).dateKey;

/** The day an order was placed on. */
export function orderDayKey(order: AdminOrder, dayOf: DayOf = calendarDayOf): string {
  return dayOf(order.placedAt);
}

/** The Amsterdam calendar day an order was delivered on, or null if it never was. */
export function deliveredDayKey(order: AdminOrder, dayOf: DayOf = calendarDayOf): string | null {
  if (order.status !== "delivered") return null;
  return order.deliveredAt ? dayOf(order.deliveredAt) : order.deliveryDate;
}

/** Real orders placed inside the range, oldest first. */
export function ordersInRange(
  orders: AdminOrder[],
  range: ReportRange,
  dayOf: DayOf = calendarDayOf
): AdminOrder[] {
  return realOrders(orders)
    .filter((o) => {
      const day = orderDayKey(o, dayOf);
      return day >= range.from && day <= range.to;
    })
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
}

/* ------------------------------------------------------------------ money */

export interface OrderMoney {
  /** Each line as charged, before the order's discount, in the order of `order.lines`. */
  lineGross: number[];
  /** Each line after its share of the discount and of any refund. Sums to `foodNet`. */
  lineNet: number[];
  foodGross: number;
  discount: number;
  foodNet: number;
  deliveryNet: number;
  refunded: number;
}

/**
 * What an order really brought in, split down to its lines.
 *
 * - A line's starting value is what it was **charged** (its stored line total), not today's
 *   menu price — so a price staff typed in, a swapped dish kept at the old price, and extras
 *   all come out right.
 * - The order's **discount** (coupon and/or a discount staff typed in — one number on the order,
 *   the same one the invoice prints) is spread over the dishes in proportion to their value.
 *   It is never taken off delivery: that is how checkout applies it.
 * - A **refund** isn't tied to a line, so it is spread pro rata over everything the customer
 *   paid for — food and delivery alike. A full refund takes every line to zero.
 *
 * Unrounded on purpose: rounding happens once, on the totals a reader sees.
 */
export function orderMoney(order: AdminOrder): OrderMoney {
  const lineGross = order.lines.map((l) => l.lineTotal ?? l.unitPrice * l.quantity);
  const foodGross = lineGross.reduce((a, b) => a + b, 0);
  // The stored discount, or — for an order whose figures say there was one but the column
  // is empty — what the totals imply (subtotal + delivery − total).
  const implied = order.subtotal + order.deliveryFee - order.total;
  const rawDiscount = order.discount > 0 ? order.discount : implied > 0.005 ? implied : 0;
  const discount = Math.min(Math.max(rawDiscount, 0), foodGross);
  const afterDiscount = foodGross > 0 ? (foodGross - discount) / foodGross : 0;
  const refundShare = order.total > 0 ? Math.min(Math.max(order.refunded / order.total, 0), 1) : 0;
  const keep = 1 - refundShare;

  return {
    lineGross,
    lineNet: lineGross.map((g) => g * afterDiscount * keep),
    foodGross,
    discount,
    foodNet: (foodGross - discount) * keep,
    deliveryNet: order.deliveryFee * keep,
    refunded: Math.max(order.refunded, 0),
  };
}

function who(order: AdminOrder): string {
  return order.customerId ?? order.customerEmail?.toLowerCase() ?? order.phone ?? order.id;
}

export function summarise(orders: AdminOrder[]): RangeSummary {
  const sales = orders.filter(isSale);
  const revenue = sales.reduce((total, o) => total + o.total - o.refunded, 0);
  let foodSales = 0;
  let foodBeforeDiscounts = 0;
  let discounts = 0;
  let deliveryFees = 0;
  let refunds = 0;
  for (const o of sales) {
    const m = orderMoney(o);
    foodSales += m.foodNet;
    foodBeforeDiscounts += m.foodGross;
    discounts += m.discount;
    deliveryFees += m.deliveryNet;
    refunds += m.refunded;
  }
  const items = sales.reduce(
    (total, o) => total + o.lines.reduce((n, line) => n + line.quantity, 0),
    0
  );
  return {
    revenue: round2(revenue),
    foodSales: round2(foodSales),
    foodBeforeDiscounts: round2(foodBeforeDiscounts),
    discounts: round2(discounts),
    deliveryFees: round2(deliveryFees),
    refunds: round2(refunds),
    orders: sales.length,
    items,
    customers: new Set(sales.map(who)).size,
    averageOrder: sales.length ? round2(revenue / sales.length) : 0,
  };
}

export type SeriesMetric = "revenue" | "food" | "orders" | "items";

/** One number per bucket, for the trend chart. */
export function seriesFor(
  orders: AdminOrder[],
  buckets: ReportBucket[],
  metric: SeriesMetric,
  dayOf: DayOf = calendarDayOf
): number[] {
  const byDay = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    const day = orderDayKey(order, dayOf);
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
        else if (metric === "food") total += orderMoney(order).foodNet;
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
  /** What it really brought in: charged, less its share of discounts and refunds. */
  revenue: number;
  /** At the prices charged, before discounts. */
  grossRevenue: number;
  /** How many separate orders contained it — not the same as portions sold. */
  orders: number;
}

/** Which dishes a line counts as, and how much of its money each one gets. */
interface DishShare {
  slug: string;
  name: string;
  quantity: number;
  gross: number;
  net: number;
}

/**
 * An ordinary line is one dish. A deal counts as the dishes inside it: "before discounts" is each
 * dish at the menu price it had when ordered, and the money really taken is spread over them in
 * proportion to those prices, so the totals still add up to what the customer paid.
 */
function dishShares(line: AdminOrder["lines"][number], gross: number, net: number): DishShare[] {
  if (!line.dealParts?.length) {
    return [{ slug: line.slug, name: line.baseName, quantity: line.quantity, gross, net }];
  }
  const value = line.dealParts.reduce((sum, p) => sum + p.listPrice * p.quantity, 0);
  return line.dealParts.map((part) => {
    const worth = part.listPrice * part.quantity;
    return {
      slug: part.slug,
      name: part.name,
      quantity: part.quantity * line.quantity,
      gross: worth * line.quantity,
      net: value > 0 ? (net * worth) / value : net / line.dealParts!.length,
    };
  });
}

export function byDish(orders: AdminOrder[], categoryByDish: Map<string, string>): DishRow[] {
  const rows = new Map<string, DishRow>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    const seen = new Set<string>();
    const money = orderMoney(order);
    order.lines.forEach((line, i) => {
      for (const share of dishShares(line, money.lineGross[i], money.lineNet[i])) {
        const row = rows.get(share.slug) ?? {
          name: share.name,
          slug: share.slug,
          category: categoryByDish.get(share.slug) ?? "Other",
          quantity: 0,
          revenue: 0,
          grossRevenue: 0,
          orders: 0,
        };
        row.quantity += share.quantity;
        row.revenue += share.net;
        row.grossRevenue += share.gross;
        if (!seen.has(share.slug)) {
          row.orders += 1;
          seen.add(share.slug);
        }
        rows.set(share.slug, row);
      }
    });
  }
  return [...rows.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), grossRevenue: round2(r.grossRevenue) }))
    .sort((a, b) => b.quantity - a.quantity);
}

export interface CategoryRow {
  label: string;
  quantity: number;
  /** After discounts and refunds, like `DishRow.revenue`. */
  revenue: number;
  grossRevenue: number;
  /** Share of the range's food sales (after discounts), as a whole percent. */
  share: number;
}

export function byCategory(
  orders: AdminOrder[],
  categoryByDish: Map<string, string>
): CategoryRow[] {
  const rows = new Map<string, { quantity: number; revenue: number; grossRevenue: number }>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    const money = orderMoney(order);
    order.lines.forEach((line, i) => {
      for (const share of dishShares(line, money.lineGross[i], money.lineNet[i])) {
        const label = categoryByDish.get(share.slug) ?? "Other";
        const row = rows.get(label) ?? { quantity: 0, revenue: 0, grossRevenue: 0 };
        row.quantity += share.quantity;
        row.revenue += share.net;
        row.grossRevenue += share.gross;
        rows.set(label, row);
      }
    });
  }
  const total = [...rows.values()].reduce((sum, r) => sum + r.revenue, 0);
  return [...rows.entries()]
    .map(([label, r]) => ({
      label,
      quantity: r.quantity,
      revenue: round2(r.revenue),
      grossRevenue: round2(r.grossRevenue),
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
  shifts: RiderShift[] = [],
  dayOf: DayOf = calendarDayOf
): RiderRow[] {
  const rows = new Map<string, RiderRow>();
  const keyFor = (id: string | null) => id ?? "unassigned";

  for (const order of realOrders(orders)) {
    const day = deliveredDayKey(order, dayOf);
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
export function byWeekday(orders: AdminOrder[], dayOf: DayOf = calendarDayOf): NamedValue[] {
  const counts = new Array(7).fill(0);
  for (const order of orders) {
    if (!isSale(order)) continue;
    // The weekday of the day the order is filed under (a Friday-night order after midnight is
    // still Friday's). A date key is a label, so it is read from its parts; getDay() gives
    // 0=Sunday, shifted so Monday is 0.
    const [y, m, d] = orderDayKey(order, dayOf).split("-").map(Number);
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7;
    counts[weekday] += 1;
  }
  return WEEKDAY_NAMES.map((label, i) => ({ label, value: counts[i] }));
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

/* -------------------------------------------------------- delivery areas */

export interface AreaRow {
  town: string;
  orders: number;
  /** Everything taken in that town: food after discounts + delivery fees, less refunds. */
  revenue: number;
  /** Food only, after discounts and refunds. */
  foodSales: number;
  items: number;
  /** Distinct people, grouped the same way the Customers screen groups them. */
  customers: number;
  averageOrder: number;
  /** This town's share of the period's delivery revenue, as a percentage. */
  share: number;
  /**
   * Average minutes from the order being placed to it being handed over, over the
   * orders in this period that were actually delivered. Null when none of them were,
   * which is printed as "—" rather than a 0 that reads like "instantly".
   */
  minutesToDeliver: number | null;
}

/**
 * How each delivery area performs — not just how many orders it sent. A pickup order
 * didn't go anywhere, so it is left out entirely (the same rule as `byTown`).
 *
 * The delivery time is measured from when the order was **placed** to when the rider
 * marked it delivered. That is the whole wait as the customer experienced it, kitchen
 * included — the number worth comparing between towns, since the cooking is the same
 * everywhere and the driving is not. An order still out on the road contributes to the
 * money and the count but not to the average, which is why a town can show orders and
 * no time.
 */
export function byArea(orders: AdminOrder[]): AreaRow[] {
  interface Acc {
    orders: number;
    revenue: number;
    foodSales: number;
    items: number;
    people: Set<string>;
    minutes: number;
    delivered: number;
  }
  const rows = new Map<string, Acc>();

  for (const order of orders) {
    if (order.fulfilment !== "delivery" || !isSale(order)) continue;
    const town = order.town?.trim() || "—";
    const acc =
      rows.get(town) ??
      ({ orders: 0, revenue: 0, foodSales: 0, items: 0, people: new Set<string>(), minutes: 0, delivered: 0 } as Acc);

    acc.orders += 1;
    acc.revenue += order.total - order.refunded;
    acc.foodSales += orderMoney(order).foodNet;
    acc.items += order.lines.reduce((n, line) => n + line.quantity, 0);
    acc.people.add(who(order));

    if (order.status === "delivered" && order.deliveredAt) {
      const minutes = (Date.parse(order.deliveredAt) - Date.parse(order.placedAt)) / 60_000;
      // A negative or absurd gap is a hand-entered order backdated by staff, not a
      // delivery that took three days — those would swamp the average, so they are skipped.
      if (minutes > 0 && minutes < 24 * 60) {
        acc.minutes += minutes;
        acc.delivered += 1;
      }
    }
    rows.set(town, acc);
  }

  const total = [...rows.values()].reduce((sum, r) => sum + r.revenue, 0);
  return [...rows.entries()]
    .map(([town, r]) => ({
      town,
      orders: r.orders,
      revenue: round2(r.revenue),
      foodSales: round2(r.foodSales),
      items: r.items,
      customers: r.people.size,
      averageOrder: r.orders ? round2(r.revenue / r.orders) : 0,
      share: total ? Math.round((r.revenue / total) * 100) : 0,
      minutesToDeliver: r.delivered ? Math.round(r.minutes / r.delivered) : null,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}

/* --------------------------------------------- new and returning customers */

export interface CustomerMixRow {
  label: string;
  newOrders: number;
  returningOrders: number;
  orders: number;
  newRevenue: number;
  returningRevenue: number;
  /** Percentage of this bucket's orders placed by someone who had ordered before. */
  returningShare: number;
}

export interface CustomerMix {
  rows: CustomerMixRow[];
  newOrders: number;
  returningOrders: number;
  /** People whose very first order falls in this period. */
  newCustomers: number;
  /** People who ordered in this period having ordered before it. */
  returningCustomers: number;
  newRevenue: number;
  returningRevenue: number;
  /** Percentage of the period's orders placed by returning customers. */
  returningShare: number;
}

/**
 * Who the orders came from: someone ordering for the first time, or someone coming back.
 *
 * "First time" is decided against **every order the shop has ever taken**, not just the
 * ones in the range — an order in October from a customer who first ordered in August is
 * a returning one, however the range is drawn. `all` is therefore the full order list and
 * `inRange` the period being reported on.
 *
 * A person is matched the same way the Customers screen matches them (account, else email,
 * else phone), so the two can never disagree about whether two orders were the same person.
 * Only real sales count on either side: an abandoned checkout is not a first order, and a
 * cancelled one doesn't make its customer "returning" next time.
 */
export function customerMix(
  all: AdminOrder[],
  inRange: AdminOrder[],
  buckets: ReportBucket[],
  dayOf: DayOf = calendarDayOf
): CustomerMix {
  // The order each person started with, oldest first — ties broken by id so the answer
  // is the same on every run.
  const firstOrderId = new Map<string, string>();
  const sortedAll = realOrders(all)
    .filter(isSale)
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt) || a.id.localeCompare(b.id));
  for (const order of sortedAll) {
    const key = who(order);
    if (!firstOrderId.has(key)) firstOrderId.set(key, order.id);
  }

  const isFirst = (order: AdminOrder) => firstOrderId.get(who(order)) === order.id;

  const rows = buckets.map((bucket): CustomerMixRow => {
    let newOrders = 0;
    let returningOrders = 0;
    let newRevenue = 0;
    let returningRevenue = 0;
    for (const order of inRange) {
      if (!isSale(order)) continue;
      const day = orderDayKey(order, dayOf);
      if (day < bucket.from || day > bucket.to) continue;
      const money = order.total - order.refunded;
      if (isFirst(order)) {
        newOrders += 1;
        newRevenue += money;
      } else {
        returningOrders += 1;
        returningRevenue += money;
      }
    }
    const orders = newOrders + returningOrders;
    return {
      label: bucket.label,
      newOrders,
      returningOrders,
      orders,
      newRevenue: round2(newRevenue),
      returningRevenue: round2(returningRevenue),
      returningShare: orders ? Math.round((returningOrders / orders) * 100) : 0,
    };
  });

  const sales = inRange.filter(isSale);
  const newPeople = new Set<string>();
  const returningPeople = new Set<string>();
  let newOrders = 0;
  let returningOrders = 0;
  let newRevenue = 0;
  let returningRevenue = 0;
  for (const order of sales) {
    const money = order.total - order.refunded;
    if (isFirst(order)) {
      newOrders += 1;
      newRevenue += money;
      newPeople.add(who(order));
    } else {
      returningOrders += 1;
      returningRevenue += money;
      returningPeople.add(who(order));
    }
  }

  return {
    rows,
    newOrders,
    returningOrders,
    newCustomers: newPeople.size,
    // Someone who ordered twice in the period is counted once, and as returning —
    // their first order of the period made them so.
    returningCustomers: returningPeople.size,
    newRevenue: round2(newRevenue),
    returningRevenue: round2(returningRevenue),
    returningShare: sales.length ? Math.round((returningOrders / sales.length) * 100) : 0,
  };
}

/* ----------------------------------------------------------------- profit */

/**
 * What it takes to turn sales into profit. All of it comes from data the owner
 * already keeps: the recipes (food cost per portion), Menu → Supplies (what the
 * packaging of one order costs) and Settings → Tax (the VAT inside every price).
 */
export interface ProfitInputs {
  /**
   * Food cost of one portion, by dish slug, from that dish's recipe priced at the
   * ingredient costs under Menu → Ingredients. A slug that isn't here has no costed
   * recipe — **never treated as free**, it is reported as not costed.
   */
  costPerDish: Record<string, number>;
  /** What the packaging of one order costs (Menu → Supplies, "used per order"). */
  packagingPerOrder: number;
  /** VAT inside every consumer price, as a percentage. Null until the owner sets it. */
  vatRatePercent: number | null;
}

/** Strip the VAT the shop only collects and passes on. No rate set = nothing stripped. */
function exVat(amount: number, rate: number | null): number {
  return rate && rate > 0 ? amount / (1 + rate / 100) : amount;
}

export interface ProfitTotals {
  /** Everything taken, as charged, incl. VAT and delivery, less refunds. */
  grossSales: number;
  /** The VAT inside that, which is not the shop's money. 0 while no rate is set. */
  vat: number;
  /** `grossSales` without the VAT — what the profit is worked out from. */
  sales: number;
  /** Ingredients of the portions sold, for the dishes that have a costed recipe. */
  foodCost: number;
  /** Orders × the packaging one order carries. */
  packaging: number;
  profit: number;
  /** Profit as a percentage of `sales`. */
  marginPct: number;
  /** Food sales belonging to dishes whose cost is known. */
  costedSales: number;
  /** …and to dishes with no costed recipe, whose ingredients are therefore missing. */
  uncostedSales: number;
  /** `costedSales` as a percentage of the two together — how much of this is real. */
  coveragePct: number;
  /** Distinct dishes sold that have no costed recipe. */
  uncostedDishes: number;
  portions: number;
  portionsUncosted: number;
  orders: number;
}

/** The food cost of one order's portions, split into what is known and what isn't. */
function orderFoodCost(
  order: AdminOrder,
  costPerDish: Record<string, number>
): { cost: number; costedNet: number; uncostedNet: number; portions: number; portionsUncosted: number; uncosted: string[] } {
  const money = orderMoney(order);
  let cost = 0;
  let costedNet = 0;
  let uncostedNet = 0;
  let portions = 0;
  let portionsUncosted = 0;
  const uncosted: string[] = [];

  order.lines.forEach((line, i) => {
    for (const share of dishShares(line, money.lineGross[i], money.lineNet[i])) {
      portions += share.quantity;
      const per = costPerDish[share.slug];
      if (per === undefined || !(per > 0)) {
        uncostedNet += share.net;
        portionsUncosted += share.quantity;
        uncosted.push(share.slug);
        continue;
      }
      // The full cost of what was cooked. A partly refunded order therefore shows the
      // loss it really was: the food was made whatever came back to the customer.
      cost += per * share.quantity;
      costedNet += share.net;
    }
  });

  return { cost, costedNet, uncostedNet, portions, portionsUncosted, uncosted };
}

/**
 * Gross profit for a period: what was taken, less the ingredients of what was cooked and
 * the packaging it went out in.
 *
 * **It is gross, and the screen says so** — wages, rent, fuel, the payment provider's cut
 * and everything else the kitchen pays are not in it, because nothing in this system
 * records them. And a dish with no costed recipe contributes its sales but no cost, so
 * `coveragePct` is reported beside every figure: at less than 100% the profit shown is
 * higher than the real one, and the screen refuses to print a figure at all when nothing
 * sold can be costed.
 */
export function profitTotals(orders: AdminOrder[], inputs: ProfitInputs): ProfitTotals {
  const sales = orders.filter(isSale);
  let grossSales = 0;
  let foodCost = 0;
  let costedNet = 0;
  let uncostedNet = 0;
  let portions = 0;
  let portionsUncosted = 0;
  const uncostedDishes = new Set<string>();

  for (const order of sales) {
    grossSales += order.total - order.refunded;
    const part = orderFoodCost(order, inputs.costPerDish);
    foodCost += part.cost;
    costedNet += part.costedNet;
    uncostedNet += part.uncostedNet;
    portions += part.portions;
    portionsUncosted += part.portionsUncosted;
    for (const slug of part.uncosted) uncostedDishes.add(slug);
  }

  const packaging = sales.length * Math.max(inputs.packagingPerOrder, 0);
  const net = exVat(grossSales, inputs.vatRatePercent);
  const profit = net - foodCost - packaging;
  const food = costedNet + uncostedNet;

  return {
    grossSales: round2(grossSales),
    vat: round2(grossSales - net),
    sales: round2(net),
    foodCost: round2(foodCost),
    packaging: round2(packaging),
    profit: round2(profit),
    marginPct: net > 0 ? Math.round((profit / net) * 100) : 0,
    costedSales: round2(costedNet),
    uncostedSales: round2(uncostedNet),
    coveragePct: food > 0 ? Math.round((costedNet / food) * 100) : 0,
    uncostedDishes: uncostedDishes.size,
    portions,
    portionsUncosted,
    orders: sales.length,
  };
}

export interface ProfitPoint {
  label: string;
  sales: number;
  foodCost: number;
  packaging: number;
  profit: number;
  marginPct: number;
}

/** The same three figures per bucket, for the trend. */
export function profitSeries(
  orders: AdminOrder[],
  buckets: ReportBucket[],
  inputs: ProfitInputs,
  dayOf: DayOf = calendarDayOf
): ProfitPoint[] {
  const byDay = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    if (!isSale(order)) continue;
    const day = orderDayKey(order, dayOf);
    const list = byDay.get(day);
    if (list) list.push(order);
    else byDay.set(day, [order]);
  }

  return buckets.map((bucket) => {
    const inBucket: AdminOrder[] = [];
    for (const [day, list] of byDay) {
      if (day >= bucket.from && day <= bucket.to) inBucket.push(...list);
    }
    const totals = profitTotals(inBucket, inputs);
    return {
      label: bucket.label,
      sales: totals.sales,
      foodCost: totals.foodCost,
      packaging: totals.packaging,
      profit: totals.profit,
      marginPct: totals.marginPct,
    };
  });
}

export interface ProfitDishRow {
  slug: string;
  name: string;
  category: string;
  portions: number;
  /** Net of discounts and refunds, without VAT — the same basis as the profit figure. */
  sales: number;
  /** Null when the dish has no costed recipe. */
  cost: number | null;
  profit: number | null;
  marginPct: number | null;
}

/**
 * Profit per dish. Packaging is **not** here: it belongs to an order, not to a dish, so
 * spreading it over the dishes would invent a number. A dish with no costed recipe shows
 * its sales and dashes for the rest, rather than a profit equal to its sales.
 */
export function profitByDish(
  orders: AdminOrder[],
  categoryByDish: Map<string, string>,
  inputs: ProfitInputs
): ProfitDishRow[] {
  const rows = new Map<string, { name: string; category: string; portions: number; sales: number }>();

  for (const order of orders) {
    if (!isSale(order)) continue;
    const money = orderMoney(order);
    order.lines.forEach((line, i) => {
      for (const share of dishShares(line, money.lineGross[i], money.lineNet[i])) {
        const row = rows.get(share.slug) ?? {
          name: share.name,
          category: categoryByDish.get(share.slug) ?? "Other",
          portions: 0,
          sales: 0,
        };
        row.portions += share.quantity;
        row.sales += exVat(share.net, inputs.vatRatePercent);
        rows.set(share.slug, row);
      }
    });
  }

  return [...rows.entries()]
    .map(([slug, r]) => {
      const per = inputs.costPerDish[slug];
      const known = per !== undefined && per > 0;
      const cost = known ? per * r.portions : null;
      const profit = cost === null ? null : r.sales - cost;
      return {
        slug,
        name: r.name,
        category: r.category,
        portions: r.portions,
        sales: round2(r.sales),
        cost: cost === null ? null : round2(cost),
        profit: profit === null ? null : round2(profit),
        marginPct: profit === null || r.sales <= 0 ? null : Math.round((profit / r.sales) * 100),
      };
    })
    .sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity) || b.sales - a.sales);
}

export interface ProfitCategoryRow {
  label: string;
  portions: number;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  /** Share of the period's dish profit, as a whole percent. */
  share: number;
  /** Dishes in this category that have no costed recipe. */
  uncosted: number;
  /** …and how many do. Zero means cost and profit are unknown here, not zero. */
  costed: number;
}

/** The same rolled up by category, from the rows above so the two can never disagree. */
export function profitByCategory(rows: ProfitDishRow[]): ProfitCategoryRow[] {
  const out = new Map<string, ProfitCategoryRow>();
  for (const row of rows) {
    const acc =
      out.get(row.category) ??
      { label: row.category, portions: 0, sales: 0, cost: 0, profit: 0, marginPct: 0, share: 0, uncosted: 0, costed: 0 };
    acc.portions += row.portions;
    acc.sales += row.sales;
    if (row.cost === null) acc.uncosted += 1;
    else {
      acc.costed += 1;
      acc.cost += row.cost;
      acc.profit += row.profit ?? 0;
    }
    out.set(row.category, acc);
  }
  const total = [...out.values()].reduce((sum, r) => sum + Math.max(r.profit, 0), 0);
  return [...out.values()]
    .map((r) => ({
      ...r,
      sales: round2(r.sales),
      cost: round2(r.cost),
      profit: round2(r.profit),
      marginPct: r.sales > 0 ? Math.round((r.profit / r.sales) * 100) : 0,
      share: total > 0 ? Math.round((Math.max(r.profit, 0) / total) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}
