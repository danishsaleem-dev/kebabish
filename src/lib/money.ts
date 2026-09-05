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

/** Euros -> integer cents, for anything that touches the payment provider. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
