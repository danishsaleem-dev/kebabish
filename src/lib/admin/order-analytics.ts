import type {
  AdminOrder,
  Period,
  StatusFilter,
} from "@/lib/admin/order-types";

/**
 * Pure aggregation over an already-fetched `AdminOrder[]` — no Supabase
 * calls here. DashboardView and ReportsView fetch the full order list once
 * (server-side, where the service-role key is allowed) and pass it down as
 * a prop; everything in this file just does math on that array so the
 * period/status dropdowns still feel instant, with no round-trip per click
 * — the same UX the old mock version had, now over real data.
 *
 * Bucket boundaries use the server's local calendar day/week/month rather
 * than being Europe/Amsterdam-exact. That precision matters for "is the
 * kitchen open right now" (see store-status.ts) — it doesn't for which
 * bucket a chart bar falls into.
 */

const MS_DAY = 86_400_000;

interface Bucket {
  label: string;
  start: Date;
  end: Date;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short" });
}

function bucketsEnding(period: Period, end: Date): Bucket[] {
  if (period === "daily") {
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const start = addDays(startOfDay(end), -(count - 1 - i));
      return { label: dayLabel(start), start, end: addDays(start, 1) };
    });
  }

  if (period === "weekly") {
    const count = 12;
    const weekEnd = addDays(startOfDay(end), 1); // exclusive upper bound
    return Array.from({ length: count }, (_, i) => {
      const bucketEnd = addDays(weekEnd, -(count - 1 - i) * 7);
      const start = addDays(bucketEnd, -7);
      return { label: dayLabel(start), start, end: bucketEnd };
    });
  }

  // monthly
  const count = 12;
  const anchor = new Date(end.getFullYear(), end.getMonth(), 1);
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - (count - 1 - i), 1);
    const bucketEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { label: monthLabel(start), start, end: bucketEnd };
  });
}

/** The N buckets immediately preceding `buckets` — for a "vs previous period" comparison. */
function previousBuckets(period: Period, buckets: Bucket[]): Bucket[] {
  return bucketsEnding(period, new Date(buckets[0].start.getTime() - 1));
}

function sumInBuckets(
  orders: AdminOrder[],
  buckets: Bucket[],
  value: (o: AdminOrder) => number,
  predicate?: (o: AdminOrder) => boolean
): number[] {
  return buckets.map((b) => {
    let sum = 0;
    for (const o of orders) {
      if (predicate && !predicate(o)) continue;
      const t = Date.parse(o.placedAt);
      if (t >= b.start.getTime() && t < b.end.getTime()) sum += value(o);
    }
    return sum;
  });
}

function percentDelta(total: number, prevTotal: number): number {
  if (prevTotal === 0) return total > 0 ? 100 : 0;
  return Math.round(((total - prevTotal) / prevTotal) * 100);
}

/** Chart series keyed by the two dashboard dropdowns. */
export function getOrderAnalytics(
  orders: AdminOrder[],
  status: StatusFilter,
  period: Period
) {
  const predicate = status === "all" ? undefined : (o: AdminOrder) => o.status === status;

  const buckets = bucketsEnding(period, new Date());
  const current = sumInBuckets(orders, buckets, () => 1, predicate);
  const previous = sumInBuckets(
    orders,
    previousBuckets(period, buckets),
    () => 1,
    predicate
  );

  const total = current.reduce((a, b) => a + b, 0);
  const prevTotal = previous.reduce((a, b) => a + b, 0);

  return {
    labels: buckets.map((b) => b.label),
    current,
    previous,
    total,
    delta: percentDelta(total, prevTotal),
  };
}

export function getRevenueProfile(orders: AdminOrder[], period: Period) {
  const revenue = (o: AdminOrder) => (o.status === "cancelled" ? 0 : o.total);

  const buckets = bucketsEnding(period, new Date());
  const points = sumInBuckets(orders, buckets, revenue);
  const previous = sumInBuckets(orders, previousBuckets(period, buckets), revenue);

  const total = points.reduce((a, b) => a + b, 0);
  const prevTotal = previous.reduce((a, b) => a + b, 0);

  return {
    labels: buckets.map((b) => b.label),
    points,
    total,
    delta: percentDelta(total, prevTotal),
  };
}

export function getSummaryStats(
  orders: AdminOrder[],
  joinDates: string[],
  period: Period
) {
  const analytics = getOrderAnalytics(orders, "all", period);
  const revenue = getRevenueProfile(orders, period);

  const buckets = bucketsEnding(period, new Date());
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= buckets[0].start.getTime() && t < buckets[buckets.length - 1].end.getTime();
  };
  const inPrevWindow = (iso: string) => {
    const prev = previousBuckets(period, buckets);
    const t = Date.parse(iso);
    return t >= prev[0].start.getTime() && t < prev[prev.length - 1].end.getTime();
  };

  const newCustomers = joinDates.filter(inWindow).length;
  const prevNewCustomers = joinDates.filter(inPrevWindow).length;

  return [
    {
      label: "Total Orders",
      value: analytics.total.toLocaleString("en-US"),
      delta: analytics.delta,
    },
    {
      label: "Total Revenue",
      value: `€ ${Math.round(revenue.total).toLocaleString("en-GB")}`,
      delta: revenue.delta,
    },
    {
      label: "New Customers",
      value: String(newCustomers),
      delta: percentDelta(newCustomers, prevNewCustomers),
    },
  ];
}

export function getOrderPerformance(orders: AdminOrder[]) {
  const total = orders.length;
  const pct = (statuses: AdminOrder["status"][]) =>
    total === 0
      ? 0
      : Math.round(
          (orders.filter((o) => statuses.includes(o.status)).length / total) * 100
        );

  return [
    { label: "Orders Completed", value: pct(["delivered"]), tone: "success" as const },
    {
      label: "In Progress",
      value: pct(["new", "preparing", "on_the_way"]),
      tone: "warn" as const,
    },
    { label: "Orders Cancelled", value: pct(["cancelled"]), tone: "danger" as const },
  ];
}

/* ----------------------------------------------------------------- reports */

export function getRevenueByMonth(orders: AdminOrder[]) {
  const buckets = bucketsEnding("monthly", new Date());
  const revenue = sumInBuckets(orders, buckets, (o) =>
    o.status === "cancelled" ? 0 : o.total
  );
  const counts = sumInBuckets(orders, buckets, () => 1);

  return buckets.map((b, i) => ({
    label: b.label,
    revenue: revenue[i],
    orders: counts[i],
  }));
}

/**
 * Order lines snapshot the dish, not its category — categories are a live
 * menu construct. `categoryByDish` maps each dish's slug to a category
 * label as the menu stands *today*; a dish that's since moved category (or
 * been deleted) reports under its current category, or "Other" if it no
 * longer exists. Documented trade-off, not a bug.
 */
export function getSalesByCategory(
  orders: AdminOrder[],
  categoryByDish: Map<string, string>
) {
  const revenueByLabel = new Map<string, number>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const line of order.lines) {
      const label = categoryByDish.get(line.slug) ?? "Other";
      const lineRevenue = line.unitPrice * line.quantity;
      revenueByLabel.set(label, (revenueByLabel.get(label) ?? 0) + lineRevenue);
    }
  }

  const totalRevenue = [...revenueByLabel.values()].reduce((a, b) => a + b, 0);

  return [...revenueByLabel.entries()]
    .map(([label, revenue]) => ({
      label,
      revenue: Math.round(revenue * 100) / 100,
      value: totalRevenue ? Math.round((revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function getTopDishes(orders: AdminOrder[]) {
  const byDish = new Map<string, { orders: number; revenue: number }>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const line of order.lines) {
      const entry = byDish.get(line.baseName) ?? { orders: 0, revenue: 0 };
      entry.orders += line.quantity;
      entry.revenue += line.unitPrice * line.quantity;
      byDish.set(line.baseName, entry);
    }
  }

  return [...byDish.entries()]
    .map(([name, stats]) => ({
      name,
      orders: stats.orders,
      revenue: Math.round(stats.revenue * 100) / 100,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6);
}

/** Delivery orders only — a pickup order didn't go anywhere. */
export function getOrdersByTown(orders: AdminOrder[]) {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.fulfilment !== "delivery" || order.status === "cancelled") continue;
    counts.set(order.town, (counts.get(order.town) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Fixed 11:00-22:00 axis — the kitchen's plausible service window, shown
 *  even for hours with zero orders so the chart's shape stays legible. */
export function getOrdersByHour(orders: AdminOrder[]) {
  const counts = new Map<number, number>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const hour = new Date(order.placedAt).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  return Array.from({ length: 12 }, (_, i) => {
    const hour = i + 11;
    return { label: `${hour}:00`, value: counts.get(hour) ?? 0 };
  });
}

/**
 * Only orders placed through the on-site checkout land in this table —
 * a WhatsApp order is a chat message, not a database row, so this can
 * only ever report what's actually tracked. It'll read 100% Website until
 * WhatsApp orders get a logging path of their own.
 */
export function getChannelSplit(orders: AdminOrder[]) {
  const real = orders.filter((o) => o.status !== "cancelled");
  const wa = real.filter((o) => o.channel === "whatsapp").length;
  const total = real.length;

  return [
    { label: "WhatsApp", value: total ? Math.round((wa / total) * 100) : 0 },
    { label: "Website", value: total ? 100 - Math.round((wa / total) * 100) : 0 },
  ];
}
