import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Which dishes carry the "Bestseller" badge — counted from real orders, never set by
 * hand (Danish's call: a badge that says "bestseller" should be true).
 *
 * The rule: the dishes that appeared in the most **paid** orders over the last
 * `WINDOW_DAYS`, at most `LIMIT` of them, and only if a dish was in at least
 * `MIN_ORDERS` different orders. That floor is what keeps a quiet week honest — with
 * two orders in total, "bestseller" would mean "somebody ordered it once", so no dish
 * gets the badge until there is something to count. Counted per order, not per
 * portion, so one party order of twenty kebabs doesn't crown them.
 *
 * Cached for ten minutes per server instance and never throws: no history (or no
 * database) simply means no badges.
 */

const WINDOW_DAYS = 30;
const LIMIT = 3;
const MIN_ORDERS = 3;
const TTL_MS = 10 * 60_000;

let cache: { at: number; slugs: Set<string> } | null = null;

export async function getBestsellerSlugs(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.slugs;

  let slugs = new Set<string>();
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("order_items")
      .select("order_id, item_slug, orders!inner(payment_status, created_at)")
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", since)
      .limit(6000);
    if (error) throw new Error(error.message);
    slugs = rankBestsellers((data ?? []) as { order_id: string; item_slug: string }[]);
  } catch (error) {
    console.error("[bestsellers] couldn't read order history:", error);
  }

  cache = { at: Date.now(), slugs };
  return slugs;
}

/** Pure: order lines in, the badge's dishes out. Exported for the check script. */
export function rankBestsellers(
  rows: { order_id: string; item_slug: string }[],
  limit = LIMIT,
  minOrders = MIN_ORDERS
): Set<string> {
  const orders = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = orders.get(row.item_slug) ?? new Set<string>();
    set.add(row.order_id);
    orders.set(row.item_slug, set);
  }
  return new Set(
    [...orders.entries()]
      .map(([slug, ids]) => ({ slug, count: ids.size }))
      .filter((r) => r.count >= minOrders)
      // Ties broken by slug so the badge doesn't hop between equal dishes per request.
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
      .slice(0, limit)
      .map((r) => r.slug)
  );
}
