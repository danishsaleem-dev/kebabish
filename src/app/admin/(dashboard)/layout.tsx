import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";

/**
 * Everything under this route group requires a staff/owner session.
 * `/login` lives at the top level (outside /admin entirely) so signing in
 * doesn't loop back through this guard.
 *
 * Allow-listed (owner/staff/manager) rather than deny-listed ("not
 * customer") — a customer *or* a rider session landing here (shouldn't
 * normally happen, but e.g. an old bookmark) bounces to their own home
 * instead via homeForRole. Written this way so a future role doesn't
 * silently fall through into the admin shell the way a rider would have
 * under a customer-only exclusion.
 *
 * Manager only gets this far, not further: it shares the exact same shell
 * as owner/staff, but its nav (Sidebar.tsx) shows a narrower set of
 * sections, and every owner/staff-only subtree (Team, Settings, Media,
 * Marketing, Reports, Support, Messages, and everything under Menu except
 * the food items themselves) has its own nested layout redirecting a
 * manager back to /admin — this top layout can't do that itself since it
 * has no way to know which page below it is being requested.
 *
 * AdminShell (rendered inside every page below) reads the session itself to
 * display the signed-in user, so by the time it runs here a session is
 * already guaranteed to exist and belong to owner/staff/manager.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    session.user.role !== "owner" &&
    session.user.role !== "staff" &&
    session.user.role !== "manager"
  ) {
    redirect(homeForRole(session.user.role));
  }

  return children;
}
