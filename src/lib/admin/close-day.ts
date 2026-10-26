import "server-only";
import { listOrders } from "@/lib/admin/orders-data";
import { expireStaleOrders } from "@/lib/orders";
import { listShiftsBetween, todayKey } from "@/lib/rider-shifts";
import { listClosedDays, type StoredBusinessDay } from "@/lib/business-days-data";
import {
  dateOfInstant,
  dayChecklist,
  daySummary,
  openDayFor,
  ordersBetween,
  type ChecklistItem,
  type DaySummary,
  type OpenDay,
} from "@/lib/business-day";

export interface CloseDayState {
  ready: boolean;
  days: StoredBusinessDay[];
  open: OpenDay;
  items: ChecklistItem[];
  summary: DaySummary;
  /** Orders accepted for a later day — fine to leave, shown so nobody worries about them. */
  laterScheduled: number;
  now: string;
}

/**
 * Everything the close-the-day screen shows and the close action re-checks — one function, so
 * the button can never be judged against different rules than the page showed.
 */
export async function loadCloseDayState(now: Date = new Date()): Promise<CloseDayState> {
  // A customer who walked away from the payment page shouldn't hold the day open: let the
  // usual sweep expire stale online checkouts first (at most once a minute, never throws).
  await expireStaleOrders().catch(() => {});

  const [{ ready, days }, orders] = await Promise.all([listClosedDays(), listOrders()]);
  const closed = days.map(({ businessDate, openedAt, closedAt }) => ({ businessDate, openedAt, closedAt }));
  const open = openDayFor(closed, now);

  // Rounds started during this day and not finished. The mileage log is optional (0023), so a
  // failure here only means the item can't be shown.
  const { shifts } = await listShiftsBetween(dateOfInstant(open.openedAt), todayKey()).catch(() => ({
    shifts: [],
  }));
  const openRounds = shifts
    .filter((s) => s.startKm !== null && s.endKm === null)
    .map((s) => s.riderName ?? "A rider");

  return {
    ready,
    days,
    open,
    items: dayChecklist(orders, open, now, openRounds),
    summary: daySummary(ordersBetween(orders, open.openedAt, now.toISOString())),
    laterScheduled: orders.filter(
      (o) => o.status === "scheduled" && o.deliveryDate !== null && o.deliveryDate > open.businessDate
    ).length,
    now: now.toISOString(),
  };
}
