/**
 * Manual payment-link mode.
 *
 * Until the full Mollie API integration can go live, Danish pays out through a
 * shared Mollie Payment Link (an open-amount page: the customer types the
 * amount and a description). The link can't be prefilled and gives the site no
 * way to learn that it was paid, so in this mode the checkout creates the order
 * as "awaiting payment", tells the customer exactly what to type, and staff
 * confirm the payment in Mollie and press "Mark as paid".
 *
 * The mode is the `paymentLinkUrl` setting: empty = normal Mollie checkout.
 * Only a real Mollie Payment Link host is accepted, so a mistyped or hostile
 * value in settings can never send customers somewhere else to pay.
 */

/** How long an unpaid link order holds its delivery slot — long enough for a person to confirm a payment. */
export const PAYMENT_LINK_HOLD_MINUTES = 90;

export function validPaymentLinkUrl(value: string | undefined | null): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname !== "payment-links.mollie.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}
