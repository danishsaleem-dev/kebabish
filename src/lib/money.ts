/**
 * One money formatter for the public site.
 *
 * Deliberately not locale-aware: it renders the same string on the server
 * and the client, and matches the `€ 12.50` already shipped elsewhere on
 * the site. Dutch convention is a comma (`€ 12,50`) — worth switching, but
 * as one deliberate change everywhere rather than two formats on one page.
 */
export function formatEuro(amount: number): string {
  return `€ ${amount.toFixed(2)}`;
}

/**
 * The cheapest a dish can be and still be sold.
 *
 * A guard against placeholder prices (a €0.01 "test" dish left on the menu)
 * becoming genuinely purchasable. It applies to dish prices only — extras
 * can legitimately be free. €0.50 is deliberately low enough for a sauce.
 */
export const MIN_DISH_PRICE = 0.5;

export function isSellablePrice(price: number | null | undefined): price is number {
  return price != null && price >= MIN_DISH_PRICE;
}

/** Euros -> integer cents, for anything that touches the payment provider. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * The VAT contained in a VAT-inclusive total — prices here already include
 * it, so it's extracted rather than added: total × rate / (100 + rate).
 */
export function vatIncludedCents(totalCents: number, ratePercent: number): number {
  return Math.round((totalCents * ratePercent) / (100 + ratePercent));
}

export function fromCents(cents: number): number {
  return cents / 100;
}
