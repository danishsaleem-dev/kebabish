import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof-of-possession for an order's confirmation link.
 *
 * The order reference (#KB-123456) is only six random digits, so on its own
 * it is guessable — and the confirmation page shows the customer's name,
 * address and items. The link Mollie sends the customer back to therefore
 * carries a token derived from the reference with a server secret: nobody
 * can compute it without the secret, and nothing extra needs storing.
 */
function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is not set.");
  return value;
}

export function orderAccessToken(reference: string): string {
  return createHmac("sha256", secret())
    .update(`order-access:${reference}`)
    .digest("hex")
    .slice(0, 32);
}

export function isValidOrderToken(reference: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderAccessToken(reference));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
