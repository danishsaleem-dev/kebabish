import "server-only";
import { redirect } from "next/navigation";
import { auth, type Role } from "@/lib/auth";

/**
 * Role check for server actions.
 *
 * The layout guards only protect the *page*. A server action is a public
 * POST endpoint in its own right, so anyone holding any valid session —
 * a customer included — could call one directly. Every mutating admin
 * action therefore re-checks the session itself.
 */

/** Everyone who works the back office day to day, minus riders. */
export const OWNER_STAFF: readonly Role[] = ["owner", "staff"];
/** Managers handle food items only, so dish actions admit them too. */
export const OWNER_STAFF_MANAGER: readonly Role[] = ["owner", "staff", "manager"];

/**
 * Whether the signed-in user is the owner — for deciding which buttons a page
 * shows. It decides what is *displayed* only; the actions behind those buttons
 * check the role themselves.
 */
export async function isOwner(): Promise<boolean> {
  const session = await auth();
  return session?.user.role === "owner";
}

export async function requireRole(allowed: readonly Role[]) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!allowed.includes(session.user.role)) redirect("/admin");
  return session;
}
