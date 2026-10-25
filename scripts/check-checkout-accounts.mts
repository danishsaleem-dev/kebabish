/**
 * Checks for the rules behind accounts created at checkout (src/lib/customers/account-rules.ts).
 * No database, no network:  npx tsx scripts/check-checkout-accounts.mts
 *
 * What they protect: anyone can type anyone's email at checkout, so a password-less account
 * must never hand a login to the wrong person.
 */
import {
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

const fresh = { id: "c1", passwordless: true, createdVia: "checkout" as const };
const paidOrder = { paid: true, customerId: "c1", placedAtMs: NOW - 5 * MIN };

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
