import {
  amsterdamNow,
  generateDaySlots,
  isPastCutoff,
  type AmsterdamNow,
  type ResolvedDay,
} from "@/lib/delivery-slots";

/**
 * How long an unpaid order can still be paid, and whether its delivery time still works.
 * Pure, so the confirmation page, the retry action and the admin agree.
 *
 * A single Mollie payment can't be stretched (iDEAL ends about 15 minutes after it is
 * made), so "more time" means the customer may start a *new* payment for the same order.
 *
 * Check with `npx tsx scripts/check-payment-window.mts`.
 */

/** After placing an order the customer may keep trying to pay for this long. */
export const PAY_AGAIN_HOURS = 24;

/** What staff can pick when they reopen an order. */
export const REOPEN_HOURS = [1, 3, 24, 72] as const;

/** Payment states with nothing in flight: a new payment may be started. */
export const RETRYABLE_PAYMENT = ["failed", "expired", "canceled"];

/** Staff reopened the order: payable until then, at the delivery time they approved. */
export interface PaymentReopen {
  openUntil: string;
  deliveryDate: string | null;
  slotStart: string | null;
}

export interface PayableOrder {
  paymentStatus: string;
  status: string;
  createdAt: string;
}

/** A staff reopening replaces the usual window, whether it is shorter or longer. */
export function payableUntil(createdAt: string, reopen: PaymentReopen | null): Date {
  return reopen
    ? new Date(reopen.openUntil)
    : new Date(Date.parse(createdAt) + PAY_AGAIN_HOURS * 3_600_000);
}

export function isReopenActive(reopen: PaymentReopen | null, at: Date = new Date()): boolean {
  return !!reopen && Date.parse(reopen.openUntil) > at.getTime();
}

export function canPayAgain(
  order: PayableOrder,
  reopen: PaymentReopen | null,
  at: Date = new Date()
): boolean {
  if (!RETRYABLE_PAYMENT.includes(order.paymentStatus) || order.status === "cancelled") return false;
  return payableUntil(order.createdAt, reopen).getTime() > at.getTime();
}

export type SlotProblem = "slotUnavailable" | "slotClosed" | null;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Can the order still be delivered in this window? Capacity is not judged here (only the
 * database can reserve a seat). A time staff approved while reopening skips the ordering
 * cutoff and the opening hours, but never a window that has already ended.
 */
export function slotProblem(
  slot: { date: string | null; start: string | null; end: string | null },
  day: ResolvedDay | undefined,
  reopen: PaymentReopen | null,
  at: Date = new Date()
): SlotProblem {
  const { date, start, end } = slot;
  if (!date || !start || !end) return "slotUnavailable";
  const now: AmsterdamNow = amsterdamNow(at);

  if (isReopenActive(reopen, at) && reopen!.deliveryDate === date && reopen!.slotStart === start) {
    if (date < now.dateKey) return "slotClosed";
    if (date === now.dateKey && now.minutes >= toMinutes(end)) return "slotClosed";
    return null;
  }

  if (date < now.dateKey) return "slotClosed";
  if (!day || !generateDaySlots(day).some((s) => s.start === start && s.end === end)) {
    return "slotUnavailable";
  }
  return isPastCutoff(date, start, now, day.slotMinutes) ? "slotClosed" : null;
}
