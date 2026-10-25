import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { getCustomerAccountState } from "@/lib/customers/accounts";
import { sessionStillValid } from "@/lib/customers/account-rules";

/**
 * Is this customer sign-in still good? A sign-in (a JWT) can't be taken back, so it is
 * checked against the account instead: it is refused when the account has since had its
 * password chosen or reset (`sessions_valid_after` — see account-rules.ts), when it came
 * from an order link and is more than a week old on a never-confirmed account, or when the
 * account is gone. One small read; the dashboard already reads the account anyway.
 */
export async function isCustomerSessionValid(session: Session): Promise<boolean> {
  if (session.user.role !== "customer") return true;
  try {
    const account = await getCustomerAccountState(session.user.id);
    return sessionStillValid({
      issuedAtSec: session.issuedAt,
      unconfirmed: Boolean(session.unconfirmed),
      account: account
        ? { passwordless: account.passwordless, sessionsValidAfterMs: account.sessionsValidAfterMs }
        : null,
      nowMs: Date.now(),
    });
  } catch (error) {
    // A database hiccup must not sign everybody out; the next request checks again.
    console.error("[customers] could not check a sign-in:", error);
    return true;
  }
}

/**
 * The signed-in customer, if there is one and the sign-in is still valid — otherwise null.
 * Use this wherever a customer's id is acted on (checkout, the account actions); staff
 * sessions are not customers and give null.
 */
export async function getCustomerSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") return null;
  return (await isCustomerSessionValid(session)) ? session : null;
}
