import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";

/**
 * Everything under this route group requires a staff/owner session.
 * `/login` lives at the top level (outside /admin entirely) so signing in
 * doesn't loop back through this guard.
 *
 * Allow-listed (owner/staff only) rather than deny-listed ("not customer")
 * — a customer *or* a rider session landing here (shouldn't normally
 * happen, but e.g. an old bookmark) bounces to their own home instead via
 * homeForRole. Written this way so a future role doesn't silently fall
 * through into the admin shell the way a rider would have under a
 * customer-only exclusion.
 *
 * AdminShell (rendered inside every page below) reads the session itself to
 * display the signed-in user, so by the time it runs here a session is
 * already guaranteed to exist and belong to staff/owner.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner" && session.user.role !== "staff") {
    redirect(homeForRole(session.user.role));
  }

  return children;
}
