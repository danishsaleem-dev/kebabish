/**
 * Checks for the rules behind accounts created at checkout (src/lib/customers/account-rules.ts).
 * No database, no network:  npx tsx scripts/check-checkout-accounts.mts
 *
 * What they protect: anyone can type anyone's email at checkout, so a password-less account
 * must never hand a login to the wrong person.
 */
import {
  CREATED_BY_ORDER_SLACK_MS,
  ENTER_WINDOW_MS,
  UNCONFIRMED_SESSION_DAYS,
  canEnterWithOrder,
  sessionStillValid,
} from "../src/lib/customers/account-rules";

let checks = 0;
let failures = 0;
function ok(cond: boolean, name: string) {
  checks++;
  if (!cond) {
    failures++;
    console.log("  FAIL ", name);
  }
}

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const MIN = 60_000;
const DAY = 86_400_000;

// The account is created a moment after its order is paid (same request), so it never predates it.
const fresh = { id: "c1", passwordless: true, createdVia: "checkout" as const, createdAtMs: NOW - 4 * MIN };
const paidOrder = { paid: true, customerId: "c1", placedAtMs: NOW - 5 * MIN, paidAtMs: NOW - 4 * MIN - 500 };

// ---- who may be signed in straight from an order link --------------------
ok(canEnterWithOrder({ order: paidOrder, account: fresh, nowMs: NOW }), "the buyer of a paid order, on the account it just created, is let in");
ok(!canEnterWithOrder({ order: { ...paidOrder, paid: false }, account: fresh, nowMs: NOW }), "an unpaid order never signs anyone in");
ok(!canEnterWithOrder({ order: { ...paidOrder, customerId: null }, account: fresh, nowMs: NOW }), "an order not linked to the account never signs anyone in");
ok(!canEnterWithOrder({ order: { ...paidOrder, customerId: "someone-else" }, account: fresh, nowMs: NOW }), "an order that belongs to a different account never signs anyone in");
ok(!canEnterWithOrder({ order: paidOrder, account: null, nowMs: NOW }), "no account, no sign-in");
ok(
  !canEnterWithOrder({ order: paidOrder, account: { ...fresh, passwordless: false }, nowMs: NOW }),
  "an account WITH a password is never signed in by a link — that person signs in with it (the typed-someone-else's-email case)"
);
ok(
  !canEnterWithOrder({ order: paidOrder, account: { ...fresh, createdVia: "signup" }, nowMs: NOW }),
  "a self-registered account is never signed in by an order link"
);
ok(canEnterWithOrder({ order: { ...paidOrder, placedAtMs: NOW - ENTER_WINDOW_MS }, account: fresh, nowMs: NOW }), "still allowed right at the end of the window");
ok(!canEnterWithOrder({ order: { ...paidOrder, placedAtMs: NOW - ENTER_WINDOW_MS - 1 }, account: fresh, nowMs: NOW }), "an old link (past the window) no longer signs anyone in");
ok(!canEnterWithOrder({ order: { ...paidOrder, placedAtMs: NOW - 2 * DAY }, account: fresh, nowMs: NOW }), "a link from two days ago does not either");

// ---- an order linked to an account by its email is not a way into it -------
// Orders placed with an address that already has an account are attached to that account (so
// the customer is not listed twice as a guest). That must not turn a *link* into a *login*:
// the account below was made by an earlier order and is still password-less, which is exactly
// when someone typing its address at checkout would otherwise get in and read its history.
const laterOrder = { paid: true, customerId: "c1", placedAtMs: NOW - 20 * MIN, paidAtMs: NOW - 19 * MIN };
const oldAccount = { ...fresh, createdAtMs: NOW - 3 * DAY };
ok(
  !canEnterWithOrder({ order: laterOrder, account: oldAccount, nowMs: NOW }),
  "an order paid AFTER the account existed, linked to it by email, never signs anyone in"
);
ok(
  !canEnterWithOrder({ order: { ...laterOrder, paidAtMs: oldAccount.createdAtMs + CREATED_BY_ORDER_SLACK_MS + 1 }, account: oldAccount, nowMs: NOW }),
  "one millisecond past the clock-skew allowance is already too late"
);
ok(
  canEnterWithOrder({ order: { ...paidOrder, paidAtMs: fresh.createdAtMs + CREATED_BY_ORDER_SLACK_MS }, account: fresh, nowMs: NOW }),
  "an order paid within the allowance of the account's creation is the one that created it"
);
ok(
  !canEnterWithOrder({ order: { ...paidOrder, paidAtMs: null }, account: fresh, nowMs: NOW }),
  "an order with no payment time cannot show it created the account, so it is refused"
);

// ---- is an existing sign-in still good? ----------------------------------
const sec = (ms: number) => Math.floor(ms / 1000);
const live = { passwordless: false, sessionsValidAfterMs: null };

ok(sessionStillValid({ issuedAtSec: sec(NOW - DAY), unconfirmed: false, account: live, nowMs: NOW }), "an ordinary sign-in on an ordinary account is valid");
ok(!sessionStillValid({ issuedAtSec: sec(NOW), unconfirmed: false, account: null, nowMs: NOW }), "a sign-in for an account that no longer exists is not valid");
ok(sessionStillValid({ issuedAtSec: undefined, unconfirmed: false, account: live, nowMs: NOW }), "a sign-in from before the field existed is treated as just issued");

// The attack the revocation exists for: X types victim@mail at checkout, gets a login, then the
// real owner chooses a password. X's login must stop working; the owner's own new one must not.
const ownerChosePasswordAt = NOW - 10 * MIN;
const afterConfirm = { passwordless: false, sessionsValidAfterMs: ownerChosePasswordAt };
ok(
  !sessionStillValid({ issuedAtSec: sec(ownerChosePasswordAt - 30 * MIN), unconfirmed: true, account: afterConfirm, nowMs: NOW }),
  "a sign-in made before the owner chose a password is ended"
);
ok(
  sessionStillValid({ issuedAtSec: sec(ownerChosePasswordAt + 2 * MIN), unconfirmed: false, account: afterConfirm, nowMs: NOW }),
  "a sign-in made after it is valid"
);
ok(
  sessionStillValid({ issuedAtSec: sec(ownerChosePasswordAt), unconfirmed: false, account: afterConfirm, nowMs: NOW }),
  "a sign-in in the very same second as the password change is not wrongly ended (whole-second token times)"
);
ok(
  !sessionStillValid({ issuedAtSec: sec(ownerChosePasswordAt - 5000), unconfirmed: false, account: afterConfirm, nowMs: NOW }),
  "…but five seconds before it is"
);

// Never-confirmed account: the order-link sign-in dies after a week.
const waiting = { passwordless: true, sessionsValidAfterMs: null };
ok(sessionStillValid({ issuedAtSec: sec(NOW - 6 * DAY), unconfirmed: true, account: waiting, nowMs: NOW }), "an order-link sign-in is fine at six days");
ok(
  !sessionStillValid({ issuedAtSec: sec(NOW - (UNCONFIRMED_SESSION_DAYS * DAY + MIN)), unconfirmed: true, account: waiting, nowMs: NOW }),
  "…and ended after a week on an account that was never confirmed"
);
ok(
  sessionStillValid({ issuedAtSec: sec(NOW - 30 * DAY), unconfirmed: false, account: live, nowMs: NOW }),
  "a normal password sign-in is not subject to the one-week limit"
);
ok(
  sessionStillValid({ issuedAtSec: sec(NOW - 30 * DAY), unconfirmed: true, account: { passwordless: false, sessionsValidAfterMs: null }, nowMs: NOW }),
  "once the account has a password the week limit no longer applies"
);

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
