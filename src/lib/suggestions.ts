import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { getPublicMenu, type PublicMenuItem } from "@/lib/public-menu";

/**
 * "Often bought with" — what to suggest next to a dish, or next to a whole basket.
 *
 * Three signals, strongest first, because a kitchen with a handful of orders has
 * too little history to rely on the data alone:
 *  1. **Picked by the owner** — a dish's own "Often bought with" list in the admin.
 *  2. **Bought together** — dishes that really were in the same paid order (the last
 *     120 days), counted from the order lines.
 *  3. **Popular / featured** — what sells, then what the owner features, so the strip
 *     is never empty and never random.
 * A dish from a *different* category scores a little higher than one from the same
 * category (a sauce or a drink beside a main beats a second main), and a dish that
 * can't be ordered (sold out, no price) is never suggested. Nothing here invents a
 * claim: the section is titled "often bought with" only because it leans on
 * the three signals above, and falls back to "popular" ones.
 */

export interface SuggestionCard {
  slug: string;
  name: string;
  price: number;
  image?: string;
  portion: string;
  vegetarian: boolean;
  /** Has a required extras choice (e.g. a sauce): can't be added in one tap. */
  needsChoice: boolean;
}

interface OrderStats {
  /** How many paid orders each dish appeared in. */
  popularity: Map<string, number>;
  /** For each dish, how often each other dish shared an order with it. */
  together: Map<string, Map<string, number>>;
}

const STATS_TTL_MS = 10 * 60_000;
const STATS_WINDOW_DAYS = 120;
let statsCache: { at: number; stats: OrderStats } | null = null;

async function orderStats(): Promise<OrderStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.stats;

  const stats: OrderStats = { popularity: new Map(), together: new Map() };
  try {
    const since = new Date(Date.now() - STATS_WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("order_items")
      .select("order_id, item_slug, orders!inner(payment_status, created_at)")
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", since)
      .limit(6000);
    if (error) throw new Error(error.message);

    const byOrder = new Map<string, Set<string>>();
    for (const row of (data ?? []) as { order_id: string; item_slug: string }[]) {
      const set = byOrder.get(row.order_id) ?? new Set<string>();
      set.add(row.item_slug);
      byOrder.set(row.order_id, set);
    }
    for (const slugs of byOrder.values()) {
      for (const a of slugs) {
        stats.popularity.set(a, (stats.popularity.get(a) ?? 0) + 1);
        for (const b of slugs) {
          if (a === b) continue;
          const row = stats.together.get(a) ?? new Map<string, number>();
          row.set(b, (row.get(b) ?? 0) + 1);
          stats.together.set(a, row);
        }
      }
    }
  } catch (error) {
    // No history is not an error worth a broken strip: the other signals still work.
    console.error("[suggestions] couldn't read order history:", error);
  }

  statsCache = { at: Date.now(), stats };
  return stats;
}

const toCard = (item: PublicMenuItem): SuggestionCard => ({
  slug: item.slug,
  name: item.name,
  price: item.price as number,
  image: item.image,
  portion: item.portion,
  vegetarian: item.vegetarian,
  needsChoice: item.optionGroups.some((g) => g.minChoices > 0),
});

export async function getSuggestions({
  slugs,
  exclude = [],
  locale = "nl",
  limit = 4,
}: {
  /** The dish(es) being looked at, or everything in the basket. */
  slugs: string[];
  /** Never suggest these (already in the basket). */
  exclude?: string[];
  locale?: string;
  limit?: number;
}): Promise<SuggestionCard[]> {
  const [menu, store, stats] = await Promise.all([
    getPublicMenu(locale),
    readStore().catch(() => null),
    orderStats(),
  ]);

  const base = new Set(slugs);
  const skip = new Set([...slugs, ...exclude]);
  const pairs = new Map((store?.items ?? []).map((i) => [i.slug, i.pairsWith ?? []]));
  const baseCategories = new Set(
    menu.filter((c) => c.items.some((i) => base.has(i.slug))).map((c) => c.id)
  );

  const scored: { item: PublicMenuItem; score: number }[] = [];
  for (const category of menu) {
    for (const item of category.items) {
      if (skip.has(item.slug) || item.soldOut || item.price == null) continue;

      let score = 0;
      for (const slug of base) {
        if (pairs.get(slug)?.includes(item.slug)) score += 100;
        score += 10 * (stats.together.get(slug)?.get(item.slug) ?? 0);
      }
      score += Math.min(stats.popularity.get(item.slug) ?? 0, 10);
      if (item.featured) score += 2;
      if (baseCategories.size > 0 && !baseCategories.has(category.id)) score += 3;
      scored.push({ item, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ item }) => toCard(item));
}
