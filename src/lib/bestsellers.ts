import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * What sells, counted from real orders — never set by hand (Danish's call: a badge that
 * says "bestseller", and a section called "popular", should be true).
 *
 * Two uses of the same count (in how many **paid** orders a dish appeared, per order,
 * not per portion, so one party order of twenty kebabs doesn't crown them):
 *
 * - **The "Bestseller" badge** (`getBestsellerSlugs`): the dishes in the most paid orders
 *   over the last `BADGE_WINDOW_DAYS`, at most `BADGE_LIMIT`, and only if a dish was in at
 *   least `BADGE_MIN_ORDERS` different orders. That floor keeps a quiet week honest —
 *   with two orders in total, "bestseller" would mean "somebody ordered it once".
 * - **The homepage's Popular dishes** (`getOrderCounts(POPULAR_WINDOW_DAYS)`, used by
 *   `getPopularItems` in public-menu.ts): a longer window, so the ranking has enough to go
 *   on, with the owner's "featured" ticks filling in while it doesn't.
 *
 * Cached for ten minutes per server instance and per window; never throws — no history
 * (or no database) simply means no counts.
 */

const BADGE_WINDOW_DAYS = 30;
const BADGE_LIMIT = 3;
const BADGE_MIN_ORDERS = 3;
export const POPULAR_WINDOW_DAYS = 90;
const TTL_MS = 10 * 60_000;

type Row = { order_id: string; item_slug: string };
const cache = new Map<number, { at: number; rows: Row[] }>();

async function paidOrderLines(windowDays: number): Promise<Row[]> {
  const hit = cache.get(windowDays);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  let rows: Row[] = [];
  try {
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("order_items")
      .select("order_id, item_slug, orders!inner(payment_status, created_at)")
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", since)
      .limit(6000);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as Row[];
  } catch (error) {
    console.error("[bestsellers] couldn't read order history:", error);
  }

  cache.set(windowDays, { at: Date.now(), rows });
  return rows;
}

/** Pure: for each dish, in how many different orders it appeared. */
export function countOrders(rows: Row[]): Map<string, number> {
  const orders = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = orders.get(row.item_slug) ?? new Set<string>();
    set.add(row.order_id);
    orders.set(row.item_slug, set);
  }
  return new Map([...orders].map(([slug, ids]) => [slug, ids.size]));
}

/** In how many paid orders each dish appeared over the last `windowDays`. */
export async function getOrderCounts(windowDays: number): Promise<Map<string, number>> {
  return countOrders(await paidOrderLines(windowDays));
}

export async function getBestsellerSlugs(): Promise<Set<string>> {
  return rankBestsellers(await paidOrderLines(BADGE_WINDOW_DAYS));
}

/** Pure: order lines in, the badge's dishes out. */
export function rankBestsellers(
  rows: Row[],
  limit = BADGE_LIMIT,
  minOrders = BADGE_MIN_ORDERS
): Set<string> {
  return new Set(
    [...countOrders(rows)]
      .map(([slug, count]) => ({ slug, count }))
      .filter((r) => r.count >= minOrders)
      // Ties broken by slug so the badge doesn't hop between equal dishes per request.
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
      .slice(0, limit)
      .map((r) => r.slug)
  );
}
