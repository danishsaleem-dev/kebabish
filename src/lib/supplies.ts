import type { StoredSupply, SupplyKind } from "@/lib/admin/store/types";

/**
 * Supplies: the things the kitchen buys that nobody eats — boxes, bags, gloves, receipt paper.
 * Kept apart from ingredients so they never appear in a recipe, an allergen list or the public
 * menu. Pure and isomorphic (no I/O), so the reports can use the same rules in the browser.
 *
 * Two kinds, because they are costed differently:
 *  - "per-order": each order uses some (a box, a bag, a fork). The cost belongs on every order.
 *  - "running":   used up over time (gloves, cling film, bin liners). The cost belongs to the
 *                 period it was bought in, not to any one order.
 */

export const SUPPLY_UNITS = ["g", "kg", "ml", "l", "pcs", "m"] as const;

export const SUPPLY_KIND_LABELS: Record<SupplyKind, string> = {
  "per-order": "Per order",
  running: "Running the kitchen",
};

/** Base price ÷ base quantity, or null until both are known. Never stored: always derived. */
export function supplyCostPerUnit(s: Pick<StoredSupply, "baseQuantity" | "basePrice">): number | null {
  if (!s.baseQuantity || s.baseQuantity <= 0 || s.basePrice === undefined) return null;
  return Math.round((s.basePrice / s.baseQuantity) * 10000) / 10000;
}

export interface PerOrderLine {
  supplyId: string;
  name: string;
  unit: string;
  perOrderQuantity: number;
  costPerUnit: number;
  /** What this supply adds to one order, in euros. */
  cost: number;
}

export interface PerOrderCost {
  lines: PerOrderLine[];
  /** Sum of the lines: the packaging cost carried by one order, in euros. */
  total: number;
  /** Per-order supplies that can't be counted yet (no quantity per order, or no price). */
  incomplete: { supplyId: string; name: string; reason: "quantity" | "price" }[];
}

/**
 * What one order costs in supplies. A supply only counts once the owner has said how many are
 * used per order *and* it has a price — a guess here would quietly distort every margin, so an
 * unfinished one is reported in `incomplete` instead of being costed as zero.
 */
export function perOrderCost(supplies: StoredSupply[]): PerOrderCost {
  const lines: PerOrderLine[] = [];
  const incomplete: PerOrderCost["incomplete"] = [];
  for (const s of supplies) {
    if (s.kind !== "per-order") continue;
    const cpu = supplyCostPerUnit(s);
    if (!s.perOrderQuantity || s.perOrderQuantity <= 0) {
      incomplete.push({ supplyId: s.id, name: s.name, reason: "quantity" });
      continue;
    }
    if (cpu === null) {
      incomplete.push({ supplyId: s.id, name: s.name, reason: "price" });
      continue;
    }
    lines.push({
      supplyId: s.id,
      name: s.name,
      unit: s.unit,
      perOrderQuantity: s.perOrderQuantity,
      costPerUnit: cpu,
      cost: s.perOrderQuantity * cpu,
    });
  }
  const total = lines.reduce((sum, l) => sum + l.cost, 0);
  return { lines, total: Math.round(total * 10000) / 10000, incomplete };
}

export interface SupplyPurchase {
  id: string;
  supplyId: string;
  /** The supply's name when it was bought, so a later rename or delete doesn't rewrite history. */
  supplyName: string;
  /** "YYYY-MM-DD" — the day it was bought, as a label. */
  purchasedOn: string;
  quantity: number;
  amountCents: number;
  note: string | null;
}

/** Purchases bought on or between two "YYYY-MM-DD" days. */
export function purchasesInRange(purchases: SupplyPurchase[], from: string, to: string): SupplyPurchase[] {
  return purchases.filter((p) => p.purchasedOn >= from && p.purchasedOn <= to);
}

export interface SpendRow {
  supplyId: string;
  name: string;
  kind: SupplyKind | null;
  quantity: number;
  amountCents: number;
  purchases: number;
}

/** Spend per supply, largest first. `kinds` maps a supply id to its kind (gone = null). */
export function spendBySupply(purchases: SupplyPurchase[], kinds: Map<string, SupplyKind>): SpendRow[] {
  const rows = new Map<string, SpendRow>();
  for (const p of purchases) {
    const row = rows.get(p.supplyId) ?? {
      supplyId: p.supplyId,
      name: p.supplyName,
      kind: kinds.get(p.supplyId) ?? null,
      quantity: 0,
      amountCents: 0,
      purchases: 0,
    };
    row.quantity += p.quantity;
    row.amountCents += p.amountCents;
    row.purchases += 1;
    rows.set(p.supplyId, row);
  }
  return [...rows.values()].sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));
}

export function totalSpendCents(purchases: SupplyPurchase[]): number {
  return purchases.reduce((sum, p) => sum + p.amountCents, 0);
}

/** Packaging carried by `orders` orders at today's per-order cost, in euros (2 decimals). */
export function packagingForOrders(orders: number, perOrder: number): number {
  return Math.round(orders * perOrder * 100) / 100;
}
