/**
 * The rules for accounts that are created when an order is paid — pure, no database, so
 * they can be tested on their own (`scripts/check-checkout-accounts.mts`).
 *
 * The idea (Danish's): pay, and you land on your dashboard; an email lets you choose a
 * password, which is what confirms the account. The danger is the email address: anyone
 * can type anyone's address at checkout. So:
 *
 *  - An account with no password cannot sign in with one — typing an address gets you
 *    nothing on its own.
 *  - The buyer is let straight in only if the account was **created by this very order**
 *    (so it holds nothing but this order), the order is paid, and it is recent. An
 *    address that already had an account is never signed in automatically.
 *  - When the real owner chooses a password, every sign-in issued before that moment
 *    stops working (`sessions_valid_after`), so the person who typed the address cannot
 *    keep a login on somebody else's account.
 *  - A never-confirmed account's sign-in also dies after a week, and the account itself
 *    is deleted after 90 days (the orders stay).
 */

/** How long after paying the order link may still sign the buyer in. */
export const ENTER_WINDOW_MS = 3 * 60 * 60_000;

/** How long the "choose your password" link in the email works. */
export const ACCOUNT_SETUP_DAYS = 7;

/** A sign-in on an account that never chose a password ends after this many days. */
export const UNCONFIRMED_SESSION_DAYS = 7;

/** An account nobody ever confirmed is deleted after this many days (its orders are kept). */
export const UNUSED_ACCOUNT_DAYS = 90;

export interface AccountForRules {
  id: string;
  /** No password chosen yet. */
  passwordless: boolean;
  createdVia: "signup" | "checkout";
}

/**
 * May the holder of this order's link be signed straight into its account?
 * Only when the order itself created the (still password-less) account.
 */
export function canEnterWithOrder(input: {
  order: { paid: boolean; customerId: string | null; placedAtMs: number };
  account: AccountForRules | null;
  nowMs: number;
}): boolean {
  const { order, account, nowMs } = input;
  if (!account || !order.paid || !order.customerId) return false;
  if (order.customerId !== account.id) return false;
  if (!account.passwordless || account.createdVia !== "checkout") return false;
  return nowMs - order.placedAtMs <= ENTER_WINDOW_MS;
}

/** Is a sign-in (issued at `issuedAtSec`) still good for this account? */
export function sessionStillValid(input: {
  /** `iat` of the sign-in token, in seconds. Missing = an old token: treated as just issued. */
  issuedAtSec: number | undefined;
  /** The sign-in came from an order link rather than a password. */
  unconfirmed: boolean;
  account: { passwordless: boolean; sessionsValidAfterMs: number | null } | null;
  nowMs: number;
}): boolean {
  const { issuedAtSec, unconfirmed, account, nowMs } = input;
  if (!account) return false; // the account is gone
  const issuedMs = issuedAtSec ? issuedAtSec * 1000 : nowMs;
  // `iat` is whole seconds, so allow a second of slack: a sign-in made the instant after a
  // password was chosen must not count as "before" it.
  if (account.sessionsValidAfterMs != null && issuedMs < account.sessionsValidAfterMs - 1000) return false;
  if (unconfirmed && account.passwordless && nowMs - issuedMs > UNCONFIRMED_SESSION_DAYS * 86_400_000) {
    return false;
  }
  return true;
}
