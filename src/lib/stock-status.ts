/** Stock health — pure, so the admin screens (browser) and the server share one rule. */

export interface StockEntry {
  /** Portions / batch left. */
  quantity: number;
  /** "Selling fast" begins at or below this many (0 = never warn). */
  lowThreshold: number;
}

/**
 * - `untracked`: the dish has no stock quantity (it's available until someone marks it sold out)
 * - `ok`: comfortably in stock
 * - `low`: still orderable, but at or below the dish's warning level
 * - `out`: nothing left
 */
export type StockLevel = "untracked" | "ok" | "low" | "out";

export const DEFAULT_LOW_THRESHOLD = 5;

export function stockLevel(entry: StockEntry | null | undefined): StockLevel {
  if (!entry) return "untracked";
  if (entry.quantity <= 0) return "out";
  if (entry.lowThreshold > 0 && entry.quantity <= entry.lowThreshold) return "low";
  return "ok";
}
