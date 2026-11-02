import "server-only";
import { readStore } from "@/lib/admin/store";
import { getOrderByReference, orderableCents, type ReceiptLine } from "@/lib/orders";
import { isSellablePrice } from "@/lib/money";
import { REMOVED, dealLineName, dealSlugOf, evaluateDeal, isDealSlug, type DealPicks } from "@/lib/deals";
import { dishImage } from "@/lib/dish-images";
import { readStockMap } from "@/lib/stock";
import { stockLevel } from "@/lib/stock-status";
import type { StoreShape } from "@/lib/admin/store/types";

/**
 * "Order this again": a past order turned back into basket lines, against **today's**
 * menu and prices.
 *
 * An order line snapshots what was agreed then — the Dutch name, the price, and the
 * extras by *label* (not by id). So each line is looked up again by slug, and each
 * extra is matched back to the dish's current extras by its group and option label.
 * A line is left out (and named in `skipped`, so the customer is told) when the dish
 * is gone, hidden, unpriced or sold out, when one of its extras no longer exists, or
 * when the dish has since gained a required choice the old order didn't make. The
 * prices returned are the current ones; nothing here is trusted later either — the
 * basket re-checks itself and `priceCart` re-prices everything at payment.
 */

export interface ReorderLine {
  slug: string;
  name: string;
  unitPrice: number;
  options: {
    groupId: string;
    groupLabel: string;
    optionId: string;
    optionLabel: string;
    price: number;
  }[];
  instructions: string;
  quantity: number;
  image?: string;
}

export interface Reorder {
  reference: string;
  lines: ReorderLine[];
  /** Names (as on the old order) of what couldn't be put back. */
  skipped: string[];
}

const pick = (locale: string, base: string, english?: string) =>
  locale === "en" && english?.trim() ? english : base;

function imageFor(item: StoreShape["items"][number], store: StoreShape): string | undefined {
  const uploaded = item.imageIds?.length
    ? (store.media ?? []).find((m) => m.id === item.imageIds[0])?.url
    : undefined;
  return uploaded ?? dishImage(item.slug);
}

/**
 * A past deal against today's deal: the same dish in each part, or the line is left out. The
 * basket's own check then says whether a dish in it has sold out since.
 */
function reorderDeal(old: ReceiptLine, store: StoreShape, locale: string): ReorderLine | null {
  const deal = store.deals.find((d) => d.slug === dealSlugOf(old.slug));
  if (!deal?.visible) return null;

  const picks: DealPicks = {};
  for (const option of old.options) {
    if (option.deal) picks[option.deal.slot] = option.deal.item ?? REMOVED;
  }
  if (!evaluateDeal(deal, picks, (slug) => orderableCents(slug, store)).ok) return null;

  const nameOf = (slug: string) => {
    const item = store.items.find((i) => i.slug === slug);
    return item ? pick(locale, item.name, item.nameEn) : slug;
  };
  return {
    slug: old.slug,
    name: dealLineName(pick(locale, deal.name, deal.nameEn)),
    unitPrice: deal.price,
    options: deal.slots.map((slot) => {
      const chosen = picks[slot.id];
      const removed = chosen === REMOVED;
      const name = removed ? slot.itemSlugs.map(nameOf).join(" / ") : nameOf(chosen);
      return {
        groupId: slot.id,
        groupLabel: "Deal",
        optionId: chosen,
        optionLabel: removed
          ? `${locale === "en" ? "Without" : "Zonder"} ${name}`
          : slot.quantity > 1
            ? `${slot.quantity} × ${name}`
            : name,
        price: removed ? -slot.removeCredit : 0,
      };
    }),
    instructions: (old.instructions ?? "").slice(0, 300),
    quantity: Math.min(Math.max(old.quantity, 1), 50),
    image: (store.media ?? []).find((m) => m.id === deal.imageId)?.url,
  };
}

export async function buildReorder(reference: string, locale: string): Promise<Reorder | null> {
  const order = await getOrderByReference(reference);
  if (!order) return null;
  const [store, stock] = await Promise.all([readStore(), readStockMap()]);

  const lines: ReorderLine[] = [];
  const skipped: string[] = [];

  for (const old of order.lines) {
    if (isDealSlug(old.slug)) {
      const line = reorderDeal(old, store, locale);
      if (line) lines.push(line);
      else skipped.push(old.name);
      continue;
    }
    const item = store.items.find((i) => i.slug === old.slug);
    const category = item && store.categories.find((c) => c.id === item.categoryId);
    if (
      !item ||
      !item.visible ||
      !category?.visible ||
      !isSellablePrice(item.price) ||
      item.soldOut ||
      stockLevel(stock?.get(item.slug)) === "out"
    ) {
      skipped.push(old.name);
      continue;
    }

    const groups = (item.optionGroupIds ?? [])
      .map((id) => (store.optionGroups ?? []).find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));

    const options: ReorderLine["options"] = [];
    let broken = false;
    for (const chosen of old.options) {
      const group = groups.find((g) => g.label === chosen.groupLabel);
      const option = group?.options.find((o) => o.label === chosen.optionLabel);
      if (!group || !option) {
        broken = true;
        break;
      }
      options.push({
        groupId: group.id,
        groupLabel: pick(locale, group.label, group.labelEn),
        optionId: option.id,
        optionLabel: pick(locale, option.label, option.labelEn),
        price: option.price,
      });
    }
    const missingRequired = groups.some(
      (g) => g.minChoices > 0 && options.filter((o) => o.groupId === g.id).length < g.minChoices
    );
    if (broken || missingRequired) {
      skipped.push(old.name);
      continue;
    }

    lines.push({
      slug: item.slug,
      name: pick(locale, item.name, item.nameEn),
      unitPrice: item.price,
      options,
      instructions: (old.instructions ?? "").slice(0, 300),
      quantity: Math.min(Math.max(old.quantity, 1), 50),
      image: imageFor(item, store),
    });
  }

  return { reference: order.reference, lines, skipped };
}
