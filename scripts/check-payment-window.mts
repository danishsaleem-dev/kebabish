/**
 * Checks for src/lib/payment-window.ts: how long an unpaid order can be paid, and whether
 * its delivery time still works. No database. Run: npx tsx scripts/check-payment-window.mts
 */
import assert from "node:assert/strict";
import { canPayAgain, payableUntil, slotProblem, type PaymentReopen } from "../src/lib/payment-window";
import type { ResolvedDay } from "../src/lib/delivery-slots";

let count = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, name);
  count++;
};

// Thursday 26 November 2026. Amsterdam is UTC+1.
const at = (time: string, date = "2026-11-26") => new Date(`${date}T${time}:00+01:00`);
const created = at("17:57").toISOString();
const order = { paymentStatus: "expired", status: "new", createdAt: created };
const day: ResolvedDay = {
  day: 4, closed: false, opens: "16:00", closes: "23:00", slotMinutes: 45, slotCapacity: 10,
};
const slot = { date: "2026-11-26", start: "18:15", end: "19:00" };
const reopen = (until: Date, over: Partial<PaymentReopen> = {}): PaymentReopen => ({
  openUntil: until.toISOString(), deliveryDate: slot.date, slotStart: slot.start, ...over,
});

// ---- how long
check("24h by default", payableUntil(created, null).toISOString(), at("17:57", "2026-11-27").toISOString());
check("payable the next afternoon", canPayAgain(order, null, at("17:00", "2026-11-27")), true);
check("not after 24h", canPayAgain(order, null, at("17:58", "2026-11-27")), false);
for (const paymentStatus of ["failed", "canceled"]) {
  check(`${paymentStatus} can retry`, canPayAgain({ ...order, paymentStatus }, null, at("18:30")), true);
}
for (const paymentStatus of ["open", "paid", "refunded"]) {
  check(`${paymentStatus} cannot`, canPayAgain({ ...order, paymentStatus }, null, at("18:30")), false);
}
check("cancelled order cannot", canPayAgain({ ...order, status: "cancelled" }, null, at("18:30")), false);
const late = reopen(at("12:00", "2026-11-30"));
check("reopened after 24h", canPayAgain(order, late, at("10:00", "2026-11-29")), true);
check("reopening ends", canPayAgain(order, late, at("12:01", "2026-11-30")), false);
check("a shorter reopening replaces the window", canPayAgain(order, reopen(at("19:00")), at("19:30")), false);
check("cancelled stays cancelled", canPayAgain({ ...order, status: "cancelled" }, late, at("18:00")), false);

// ---- the delivery time
check("open window", slotProblem(slot, day, null, at("18:20")), null);
check("closed 30 minutes in", slotProblem(slot, day, null, at("18:45")), "slotClosed");
check("yesterday", slotProblem(slot, day, null, at("10:00", "2026-11-27")), "slotClosed");
check("no time", slotProblem({ date: null, start: null, end: null }, day, null, at("10:00")), "slotUnavailable");
check("day now closed", slotProblem(slot, { ...day, closed: true }, null, at("17:00")), "slotUnavailable");
check("not a real slot", slotProblem({ ...slot, start: "18:00" }, day, null, at("17:00")), "slotUnavailable");
const approved = reopen(at("23:00"));
check("staff-approved skips the cutoff", slotProblem(slot, day, approved, at("18:50")), null);
check("but not an ended window", slotProblem(slot, day, approved, at("19:00")), "slotClosed");
check("exact time approved", slotProblem({ ...slot, start: "18:00" }, day, reopen(at("23:00"), { slotStart: "18:00" }), at("17:00")), null);
check("approval is for that time only", slotProblem(slot, day, reopen(at("23:00"), { slotStart: "19:00" }), at("18:50")), "slotClosed");
check("approval expires with the reopening", slotProblem(slot, day, reopen(at("18:00")), at("18:50")), "slotClosed");

console.log(`payment window: ${count} checks passed`);
