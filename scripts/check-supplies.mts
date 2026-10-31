/**
 * Checks for the supplies maths (src/lib/supplies.ts). No database needed.
 *   npx tsx scripts/check-supplies.mts
 */
import {
  packagingForOrders,
  perOrderCost,
  purchasesInRange,
  spendBySupply,
  supplyCostPerUnit,
  totalSpendCents,
  type SupplyPurchase,
} from "@/lib/supplies";
import type { StoredSupply, SupplyKind } from "@/lib/admin/store/types";

let checks = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const supply = (over: Partial<StoredSupply> & { id: string }): StoredSupply => ({
  name: over.id,
  unit: "pcs",
  kind: "per-order",
  ...over,
});

// cost per unit
check("50 for 5.95", close(supplyCostPerUnit({ baseQuantity: 50, basePrice: 5.95 })!, 0.119));
check("free is a valid price", supplyCostPerUnit({ baseQuantity: 10, basePrice: 0 }) === 0);
check("no quantity = unknown", supplyCostPerUnit({ basePrice: 5 }) === null);
check("no price = unknown", supplyCostPerUnit({ baseQuantity: 5 }) === null);
check("zero quantity = unknown", supplyCostPerUnit({ baseQuantity: 0, basePrice: 5 }) === null);

// per-order cost
const supplies: StoredSupply[] = [
  supply({ id: "box", baseQuantity: 50, basePrice: 5.95, perOrderQuantity: 1 }),
  supply({ id: "bag", baseQuantity: 250, basePrice: 35, perOrderQuantity: 2 }),
  supply({ id: "fork", baseQuantity: 50, basePrice: 3.45 }), // per-order but never said how many
  supply({ id: "labels", perOrderQuantity: 1 }), // no price
  supply({ id: "gloves", kind: "running", baseQuantity: 100, basePrice: 3.5, perOrderQuantity: 9 }),
];
const po = perOrderCost(supplies);
check("two lines counted", po.lines.length === 2, po.lines);
check("total = 0.119 + 2×0.14", close(po.total, 0.399), po.total);
check("running supply never counted even with a stray quantity", !po.lines.some((l) => l.supplyId === "gloves"));
check(
  "incomplete: fork (quantity), labels (price)",
  po.incomplete.length === 2 &&
    po.incomplete.some((i) => i.supplyId === "fork" && i.reason === "quantity") &&
    po.incomplete.some((i) => i.supplyId === "labels" && i.reason === "price"),
  po.incomplete
);
check("nothing set up = 0, no throw", perOrderCost([]).total === 0);
check("packaging for 100 orders", packagingForOrders(100, po.total) === 39.9, packagingForOrders(100, po.total));
check("packaging for 0 orders", packagingForOrders(0, po.total) === 0);

// purchases
const buy = (id: string, supplyId: string, day: string, qty: number, cents: number): SupplyPurchase => ({
  id,
  supplyId,
  supplyName: supplyId.toUpperCase(),
  purchasedOn: day,
  quantity: qty,
  amountCents: cents,
  note: null,
});
const bought = [
  buy("1", "box", "2026-10-31", 50, 595),
  buy("2", "box", "2026-11-01", 50, 595),
  buy("3", "gloves", "2026-11-02", 100, 350),
  buy("4", "gone", "2026-11-02", 1, 100),
  buy("5", "box", "2026-12-01", 50, 595),
];
const inRange = purchasesInRange(bought, "2026-11-01", "2026-11-30");
check("range is inclusive and ignores outside days", inRange.map((p) => p.id).join() === "2,3,4", inRange);
check("a one-day range works", purchasesInRange(bought, "2026-11-02", "2026-11-02").length === 2);
check("total spend in cents", totalSpendCents(inRange) === 1045);
const kinds = new Map<string, SupplyKind>([["box", "per-order"], ["gloves", "running"]]);
const rows = spendBySupply(inRange, kinds);
check("sorted by spend (box 595 > gloves 350 > gone 100)", rows.map((r) => r.supplyId).join() === "box,gloves,gone", rows);
check("a deleted supply keeps its name and has no kind", rows.at(-1)!.name === "GONE" && rows.at(-1)!.kind === null, rows);
check("cents never become floats", rows.every((r) => Number.isInteger(r.amountCents)));
check("empty range", spendBySupply([], kinds).length === 0 && totalSpendCents([]) === 0);

console.log(`${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
