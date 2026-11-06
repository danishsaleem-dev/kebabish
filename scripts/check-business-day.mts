/**
 * Business days and "what was really taken", checked without a database.
 *
 *   npx tsx scripts/check-business-day.mts
 *
 * Run it after touching `src/lib/business-day.ts` or `orderMoney` in `src/lib/admin/reports.ts`.
 */
import {
  canClose,
  dayChecklist,
  daySummary,
  makeDayOf,
  openDayFor,
  startOfDayIso,
  type ClosedDay,
} from "../src/lib/business-day";
import { byCategory, byDish, orderMoney, ordersInRange, summarise } from "../src/lib/admin/reports";
import type { AdminOrder } from "../src/lib/admin/order-types";
import { deliveriesOnDay } from "../src/lib/rider-mileage";

let pass = 0;
const fails: string[] = [];
function eq(name: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) pass++;
  else fails.push(`${name}: got ${a}, want ${b}`);
}
const r2 = (n: number) => Math.round(n * 100) / 100;

let seq = 0;
function order(over: Partial<AdminOrder> & { lines?: AdminOrder["lines"] }): AdminOrder {
  seq++;
  const lines = over.lines ?? [{ name: "Biryani", baseName: "Biryani", slug: "biryani", quantity: 1, unitPrice: 20, lineTotal: 20 }];
  const subtotal = lines.reduce((n, l) => n + (l.lineTotal ?? l.unitPrice * l.quantity), 0);
  const discount = over.discount ?? 0;
  const deliveryFee = over.deliveryFee ?? 0;
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`,
    reference: `KBB-2026-${seq}`,
    customerId: null,
    customerName: "Test",
    customerEmail: `t${seq}@x.nl`,
    phone: "0600000000",
    placedAt: "2026-10-26T18:00:00.000Z",
    status: "delivered",
    paymentStatus: "paid",
    channel: "website",
    channelNote: null,
    paymentMethod: "mollie",
    fulfilment: "delivery",
    town: "Hoogkarspel",
    address: "x",
    postcode: "1616AA",
    subtotal,
    discount,
    deliveryFee,
    total: subtotal - discount + deliveryFee,
    assignedRiderId: null,
    assignedRiderName: null,
    deliveredAt: null,
    paidAt: null,
    acceptedAt: null,
    refunded: 0,
    deliveryDate: "2026-10-26",
    deliverySlotStart: null,
    deliverySlotEnd: null,
    ...over,
    lines,
  };
}

// ---------------------------------------------------------------- orderMoney

{
  // 50% off a €20 + €10 order, €2.50 delivery.
  const o = order({
    lines: [
      { name: "A", baseName: "A", slug: "a", quantity: 2, unitPrice: 10, lineTotal: 20 },
      { name: "B", baseName: "B", slug: "b", quantity: 1, unitPrice: 10, lineTotal: 10 },
    ],
    discount: 15,
    deliveryFee: 2.5,
  });
  const m = orderMoney(o);
  eq("50% off: each line halved", m.lineNet.map(r2), [10, 5]);
  eq("50% off: food net", r2(m.foodNet), 15);
  eq("50% off: delivery untouched by the discount", r2(m.deliveryNet), 2.5);
  eq("50% off: lines sum to food net", r2(m.lineNet.reduce((a, b) => a + b, 0)), r2(m.foodNet));

  const dishes = byDish([o], new Map([["a", "Mains"], ["b", "Sides"]]));
  eq("dish sales are after discount", dishes.map((d) => [d.slug, d.revenue, d.grossRevenue]), [
    ["a", 10, 20],
    ["b", 5, 10],
  ]);
  const cats = byCategory([o], new Map([["a", "Mains"], ["b", "Sides"]]));
  eq("category share on net", cats.map((c) => [c.label, c.revenue, c.share]), [
    ["Mains", 10, 67],
    ["Sides", 5, 33],
  ]);
  const s = summarise([o]);
  eq("summary: revenue = total paid", s.revenue, 17.5);
  eq("summary: food sales, discounts, delivery", [s.foodSales, s.discounts, s.deliveryFees, s.foodBeforeDiscounts], [15, 15, 2.5, 30]);
}

{
  // A price staff typed in: the line total wins over unit price × quantity.
  const o = order({
    lines: [{ name: "C", baseName: "C", slug: "c", quantity: 2, unitPrice: 12, lineTotal: 18 }],
  });
  eq("a hand-set price counts as charged", r2(orderMoney(o).foodNet), 18);
}

{
  // Half refunded: everything halves, food and delivery alike.
  const o = order({ deliveryFee: 4, refunded: 12 }); // total 24
  const m = orderMoney(o);
  eq("half refund halves food", r2(m.foodNet), 10);
  eq("half refund halves delivery", r2(m.deliveryNet), 2);
  // Fully refunded: nothing left.
  const full = orderMoney(order({ refunded: 20 }));
  eq("full refund leaves zero", r2(full.foodNet), 0);
}

{
  // A discount larger than the food (shouldn't happen) is capped, never negative.
  const o = order({ discount: 50, total: 0 });
  eq("discount capped at the food", r2(orderMoney(o).foodNet), 0);
  // No stored discount, but the totals imply one.
  const implied = order({ discount: 0, total: 14 });
  eq("discount implied by the totals", r2(orderMoney(implied).discount), 6);
}

// ---------------------------------------------------------------- business days

// 2026-10-25 is the night the clocks go back in Amsterdam (CEST → CET).
const closed: ClosedDay[] = [
  { businessDate: "2026-10-24", openedAt: startOfDayIso("2026-10-24"), closedAt: "2026-10-24T23:40:00.000Z" }, // 01:40 on the 25th, local
  { businessDate: "2026-10-25", openedAt: "2026-10-24T23:40:00.000Z", closedAt: "2026-10-25T22:10:00.000Z" }, // 23:10 on the 25th
];

{
  const open = openDayFor(closed, new Date("2026-10-26T12:00:00Z"));
  eq("closing at 23:10 makes the next day the 26th", open.businessDate, "2026-10-26");
  eq("the open day starts at the last closing", open.openedAt, "2026-10-25T22:10:00.000Z");

  const dayOf = makeDayOf(closed, open);
  eq("00:30 after midnight is still the day that was open", dayOf("2026-10-24T22:30:00.000Z"), "2026-10-24");
  eq("just after a closing is the next day", dayOf("2026-10-24T23:41:00.000Z"), "2026-10-25");
  eq("23:30 after an early close is tomorrow's day", dayOf("2026-10-25T22:30:00.000Z"), "2026-10-26");
  eq("before the first closed day, calendar days", dayOf("2026-10-20T12:00:00.000Z"), "2026-10-20");

  // Same in reports: an order at 01:00 local on the 25th is filed under the 24th.
  const late = order({ placedAt: "2026-10-24T23:00:00.000Z" });
  eq("reports file a late order on the open day", ordersInRange([late], { from: "2026-10-24", to: "2026-10-24" }, dayOf).length, 1);
  eq("…and not on its calendar day", ordersInRange([late], { from: "2026-10-25", to: "2026-10-25" }, dayOf).length, 0);
}

{
  // Closing at 01:30 on the 27th: the next day opened at 01:30 on the 27th is the 27th.
  const c: ClosedDay[] = [
    { businessDate: "2026-10-26", openedAt: "2026-10-25T22:10:00.000Z", closedAt: "2026-10-27T00:30:00.000Z" },
  ];
  eq("late closing: next day keeps the calendar date", openDayFor(c, new Date("2026-10-27T10:00:00Z")).businessDate, "2026-10-27");
  // Two closings in one calendar day never share a label.
  const twice: ClosedDay[] = [
    ...c,
    { businessDate: "2026-10-27", openedAt: "2026-10-27T00:30:00.000Z", closedAt: "2026-10-27T09:00:00.000Z" },
  ];
  eq("a second closing the same day moves on a date", openDayFor(twice, new Date("2026-10-27T10:00:00Z")).businessDate, "2026-10-28");
}

{
  // First closing ever: a closing at 02:00 belongs to the evening before.
  const first = openDayFor([], new Date("2026-10-27T01:00:00Z")); // 02:00 local
  eq("first ever, small hours → yesterday", first.businessDate, "2026-10-26");
  eq("first ever starts at midnight", first.openedAt, startOfDayIso("2026-10-26"));
  eq("first ever, afternoon → today", openDayFor([], new Date("2026-10-27T13:00:00Z")).businessDate, "2026-10-27");
}

// ---------------------------------------------------------------- checklist

{
  const open = openDayFor(closed, new Date("2026-10-26T20:00:00Z"));
  const now = new Date("2026-10-26T20:00:00Z");
  const inDay = "2026-10-26T18:00:00.000Z";
  const clean = [order({ placedAt: inDay })];
  eq("a quiet day can close", canClose(dayChecklist(clean, open, now)), true);

  const waiting = order({ placedAt: inDay, status: "new" });
  const cooking = order({ placedAt: inDay, status: "preparing" });
  const unpaidCash = order({ placedAt: inDay, paymentMethod: "cash", paymentStatus: "open" });
  const later = order({ placedAt: inDay, status: "scheduled", deliveryDate: "2026-10-29" });
  const dueNow = order({ placedAt: inDay, status: "scheduled", deliveryDate: "2026-10-26" });
  const oldUnpaid = order({ placedAt: "2026-10-20T12:00:00.000Z", paymentStatus: "open", paymentMethod: "cash" });
  const cancelledUnpaid = order({ placedAt: inDay, paymentStatus: "open", status: "cancelled" });

  const items = dayChecklist([waiting, cooking, unpaidCash, later, dueNow, oldUnpaid, cancelledUnpaid], open, now, ["Ali"]);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  eq("waiting is listed", byId.waiting.orders.map((o) => o.id), [waiting.id]);
  eq("cooking + due-today scheduled are in progress", byId.inProgress.orders.map((o) => o.id), [cooking.id, dueNow.id]);
  eq("only this day's unpaid count, cancelled ones don't", byId.unpaid.orders.map((o) => o.id), [unpaidCash.id]);
  eq("an unfinished round is shown but not blocking", [byId.rounds.ok, byId.rounds.blocking], [false, false]);
  eq("cannot close with blockers", canClose(items), false);
  eq("rounds alone don't block", canClose(dayChecklist(clean, open, now, ["Ali"])), true);
}

// ---------------------------------------------------------------- summary

{
  const cash = order({ paymentMethod: "cash", discount: 10, deliveryFee: 2 }); // total 12
  const online = order({ paymentMethod: "mollie", refunded: 5 }); // total 20, kept 15
  const cancelled = order({ status: "cancelled" });
  const unpaid = order({ paymentStatus: "open" });
  const s = daySummary([cash, online, cancelled, unpaid]);
  eq("summary counts paid sales only", s.orders, 2);
  eq("cash expected in the drawer", s.byMethod.cash, 12);
  eq("online after refund", s.byMethod.mollie, 15);
  eq("revenue", s.revenue, 27);
  eq("discounts", s.discounts, 10);
  eq("cancelled paid orders counted separately", s.cancelled, 1);
}

/* ---------------------------------------------------------------------------------------
 * A rider's day ends when the office closes the day, not at midnight.
 *
 * Summer time (UTC+2), so 22:20Z is 00:20 the next morning in Amsterdam. A delivery is put on
 * its working day with makeDayOf, and a rider's round lives under the open day's label
 * (openDayFor) — these are the two halves of `currentRiderDay` in rider-shifts.ts.
 * ------------------------------------------------------------------------------------- */
{
  const delivered = (id: string, at: string, over: Partial<AdminOrder> = {}) =>
    order({ id, status: "delivered", deliveredAt: at, ...over });

  // Day 25 was closed at 23:40 on the 25th (21:40Z), so the 26th opened then.
  const closed25: ClosedDay[] = [
    { businessDate: "2026-06-25", openedAt: "2026-06-24T21:00:00.000Z", closedAt: "2026-06-25T21:40:00.000Z" },
  ];
  const evening = delivered("a", "2026-06-26T19:30:00.000Z"); // 21:30 on the 26th
  const afterMidnight = delivered("b", "2026-06-26T22:20:00.000Z"); // 00:20 on the 27th, calendar-wise
  const mine = [evening, afterMidnight];

  // Still open at 00:40 on the 27th: nobody has pressed the button.
  const stillOpen = new Date("2026-06-26T22:40:00.000Z");
  const open1 = openDayFor(closed25, stillOpen);
  eq("past midnight with the day still open, the rider is still on the 26th", open1.businessDate, "2026-06-26");
  const dayOf1 = makeDayOf(closed25, open1);
  eq("a drop at 00:20 belongs to the evening that is still open", dayOf1(afterMidnight.deliveredAt!), "2026-06-26");
  eq("so both drops are in the rider's round", deliveriesOnDay(mine, "2026-06-26", dayOf1).length, 2);
  eq("and none is on the 27th yet", deliveriesOnDay(mine, "2026-06-27", dayOf1).length, 0);

  // The old rule, for contrast: cut at midnight by the clock, the 00:20 drop slid onto the 27th.
  const byCalendar = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(iso));
  eq("(the old clock rule would have split them)", deliveriesOnDay(mine, "2026-06-26", byCalendar).length, 1);

  // Still open the next morning, after a quiet night: still the same day, still the same round.
  const morning = new Date("2026-06-27T07:00:00.000Z"); // 09:00 on the 27th
  eq("a day left open overnight is still the same day in the morning", openDayFor(closed25, morning).businessDate, "2026-06-26");

  // The office presses Close the day at 01:30 on the 27th (23:30Z): now, and only now, it ends.
  const closed26: ClosedDay[] = [
    ...closed25,
    { businessDate: "2026-06-26", openedAt: "2026-06-25T21:40:00.000Z", closedAt: "2026-06-26T23:30:00.000Z" },
  ];
  const afterClose = new Date("2026-06-27T06:00:00.000Z"); // 08:00 on the 27th
  const open2 = openDayFor(closed26, afterClose);
  eq("after closing the day, the rider's day moves on", open2.businessDate, "2026-06-27");
  const dayOf2 = makeDayOf(closed26, open2);
  const nextMorning = delivered("c", "2026-06-27T06:30:00.000Z");
  eq("the 00:20 drop stays on the 26th after the day is closed", dayOf2(afterMidnight.deliveredAt!), "2026-06-26");
  eq("a drop after the closing is on the new day", dayOf2(nextMorning.deliveredAt!), "2026-06-27");
  eq(
    "the closed day keeps both its drops",
    deliveriesOnDay([...mine, nextMorning], "2026-06-26", dayOf2).map((o) => o.id),
    ["a", "b"]
  );
  eq("the new day starts with only its own", deliveriesOnDay([...mine, nextMorning], "2026-06-27", dayOf2).map((o) => o.id), ["c"]);

  // Closing at 23:30 on the 26th: the new day is the 27th although the calendar still says the 26th.
  const closedEarly: ClosedDay[] = [
    ...closed25,
    { businessDate: "2026-06-26", openedAt: "2026-06-25T21:40:00.000Z", closedAt: "2026-06-26T21:30:00.000Z" },
  ];
  const justAfter = new Date("2026-06-26T21:35:00.000Z"); // 23:35 on the 26th
  eq("a day closed before midnight opens the next date at once", openDayFor(closedEarly, justAfter).businessDate, "2026-06-27");

  // Orders marked delivered before the delivery time was recorded fall back to the day booked.
  const legacy = order({ id: "d", status: "delivered", deliveredAt: null, deliveryDate: "2026-06-26" });
  eq("an order with no delivery time falls back to its booked day", deliveriesOnDay([legacy], "2026-06-26", dayOf1).length, 1);
  eq("only delivered orders count", deliveriesOnDay([order({ id: "e", status: "on_the_way", deliveredAt: "2026-06-26T19:00:00.000Z" })], "2026-06-26", dayOf1).length, 0);
}

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL " + f);
process.exit(fails.length ? 1 : 0);
