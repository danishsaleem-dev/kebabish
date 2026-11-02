import { MIN_DISH_PRICE, toCents } from "@/lib/money";
import type { StoredDeal, StoredDealSlot } from "@/lib/admin/store/types";

/**
 * Deals: every rule about what a deal costs, with no database in it, so the admin form, the deal
 * page and `priceCart` can't disagree. Run `npx tsx scripts/check-deals.mts` after touching this.
 *
 * **A deal is one line in the basket and on the order**, with the slug `deal:<slug>`, so the
 * customer, the kitchen ticket, the emails and the invoice all see "Deal: X" followed by what is in
 * it. Each part travels as an ordinary option: `groupId` = the slot, `optionId` = the dish chosen, or
 * `REMOVED`, whose price is minus the owner's credit. The cart needs no special case for money.
 *
 * On the order each option also carries `deal` (see `DealPartMeta`): the dish, how many portions and
 * its menu price at that moment. Stock (migration 0031) and the per-dish reports read that.
 */

export const DEAL_PREFIX = "deal:";
/** The option id of a part the customer took out. */
export const REMOVED = "none";

export const dealLineSlug = (slug: string) => `${DEAL_PREFIX}${slug}`;
export const isDealSlug = (slug: string) => slug.startsWith(DEAL_PREFIX);
export const dealSlugOf = (lineSlug: string) => lineSlug.slice(DEAL_PREFIX.length);

/** Where a basket line links back to. */
export const lineHref = (slug: string) =>
  isDealSlug(slug) ? `/deals/${dealSlugOf(slug)}` : `/menu/${slug}`;

/** "Deal: Familie", without saying it twice when the name already does. */
export const dealLineName = (name: string) => (/\bdeal\b/i.test(name) ? name : `Deal: ${name}`);

/** Snapshot on an order line's option. `item` is null for a part the customer took out. */
export interface DealPartMeta {
  slot: string;
  item: string | null;
  name: string;
  /** Portions in one deal. */
  qty: number;
  /** The dish's menu price for one portion when this was ordered. */
  listCents: number;
}

/** The dish chosen for each slot: slot id -> dish slug, or `REMOVED`. */
export type DealPicks = Record<string, string>;

/** A dish's menu price in cents, or null if it can't be priced. */
export type PriceOf = (slug: string) => number | null;

/** What the price rules read, so the public deal works here as well as the stored one. */
export type DealRules = Pick<StoredDeal, "price" | "minItems"> & {
  slots: Pick<StoredDealSlot, "id" | "itemSlugs" | "quantity" | "removable" | "removeCredit">[];
};

export type DealError = "missingPick" | "badPick" | "notRemovable" | "tooFew";

export type DealResult =
  | { ok: true; unitCents: number; creditCents: number; listCents: number; kept: number }
  | { ok: false; error: DealError };

/** What the customer pays for one deal with these picks, and what the dishes cost separately. */
export function evaluateDeal(deal: DealRules, picks: DealPicks, priceOf: PriceOf): DealResult {
  let creditCents = 0;
  let listCents = 0;
  let kept = 0;

  for (const slot of deal.slots) {
    const pick = picks[slot.id];
    if (!pick) return { ok: false, error: "missingPick" };
    if (pick === REMOVED) {
      if (!slot.removable) return { ok: false, error: "notRemovable" };
      creditCents += toCents(slot.removeCredit);
      continue;
    }
    if (!slot.itemSlugs.includes(pick)) return { ok: false, error: "badPick" };
    kept += 1;
    listCents += (priceOf(pick) ?? 0) * slot.quantity;
  }

  if (kept < Math.max(deal.minItems, 1)) return { ok: false, error: "tooFew" };
  return { ok: true, unitCents: toCents(deal.price) - creditCents, creditCents, listCents, kept };
}

/**
 * "Bought separately": each part at its **cheapest** choice, so a crossed-out price is never higher
 * than what the customer could really have paid.
 */
export function dealWasCents(deal: StoredDeal, priceOf: PriceOf): number {
  return deal.slots.reduce((sum, slot) => {
    const prices = slot.itemSlugs.map(priceOf).filter((p): p is number => p != null);
    return sum + (prices.length ? Math.min(...prices) : 0) * slot.quantity;
  }, 0);
}

/** The most that can come off: the biggest credits, for as many parts as may be removed. */
function largestRemovalCents(deal: StoredDeal): number {
  const removable = Math.max(deal.slots.length - Math.max(deal.minItems, 1), 0);
  return deal.slots
    .filter((s) => s.removable)
    .map((s) => toCents(s.removeCredit))
    .sort((a, b) => b - a)
    .slice(0, removable)
    .reduce((sum, c) => sum + c, 0);
}

export interface DealProblems {
  /** Saving is refused. */
  errors: string[];
  /** Saved, but worth a look. */
  warnings: string[];
}

/** What is wrong with a deal as the owner set it up. */
export function dealProblems(deal: StoredDeal, priceOf: PriceOf, nameOf: (slug: string) => string): DealProblems {
  const errors: string[] = [];
  const warnings: string[] = [];
  const priceCents = toCents(deal.price);

  if (deal.price < MIN_DISH_PRICE) errors.push(`A deal can't cost less than €${MIN_DISH_PRICE.toFixed(2)}.`);
  if (deal.slots.length === 0) errors.push("Add at least one dish.");
  if (deal.minItems > deal.slots.length && deal.slots.length > 0) {
    errors.push("“Must keep” is more than the number of parts in the deal.");
  }

  for (const slot of deal.slots) {
    if (slot.itemSlugs.length === 0) errors.push("One part of the deal has no dish.");
    const missing = slot.itemSlugs.filter((s) => priceOf(s) == null).map(nameOf);
    if (missing.length) warnings.push(`No price yet: ${missing.join(", ")}. Customers can't order this choice.`);
    if (slot.itemSlugs.length > 1 && !slot.label?.trim()) {
      errors.push(`Name the choice between ${slot.itemSlugs.map(nameOf).join(" / ")}, e.g. “Kies je drankje”.`);
    }
  }

  // A deal must never end up free or negative, whatever the customer takes out.
  const lowest = priceCents - largestRemovalCents(deal);
  if (deal.slots.length > 0 && lowest < toCents(MIN_DISH_PRICE)) {
    errors.push(
      `With the most parts removed the deal would cost €${(lowest / 100).toFixed(2)}. Lower the amounts taken off, or raise “must keep”.`
    );
  }

  if (errors.length === 0) {
    const was = dealWasCents(deal, priceOf);
    if (was > 0 && priceCents >= was) {
      warnings.push(`The dishes cost €${(was / 100).toFixed(2)} separately, so this deal saves the customer nothing.`);
    }
    for (const slot of deal.slots.filter((s) => s.removable)) {
      const cheapest = Math.min(...slot.itemSlugs.map((s) => priceOf(s) ?? Infinity)) * slot.quantity;
      const rest = was - (Number.isFinite(cheapest) ? cheapest : 0);
      const after = priceCents - toCents(slot.removeCredit);
      if (rest > 0 && after > rest) {
        warnings.push(
          `Without ${slot.itemSlugs.map(nameOf).join(" / ")} the deal is €${(after / 100).toFixed(2)}, more than the rest costs separately (€${(rest / 100).toFixed(2)}). Take more off.`
        );
      }
    }
  }
  return { errors, warnings };
}

/**
 * A fair amount to take off for each part: its share of the deal price, to the nearest 10 cents.
 * What the "Suggest amounts" button fills in; the owner can change every figure.
 */
export function suggestedCredits(deal: StoredDeal, priceOf: PriceOf): Record<string, number> {
  const was = dealWasCents(deal, priceOf);
  const out: Record<string, number> = {};
  if (was <= 0) return out;
  for (const slot of deal.slots) {
    const prices = slot.itemSlugs.map(priceOf).filter((p): p is number => p != null);
    const part = (prices.length ? Math.min(...prices) : 0) * slot.quantity;
    out[slot.id] = Math.round((part / was) * deal.price * 10) / 10;
  }
  return out;
}
