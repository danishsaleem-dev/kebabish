import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";

/**
 * Everything under this route group requires a staff/owner session.
 * `/login` lives at the top level (outside /admin entirely) so signing in
 * doesn't loop back through this guard.
 *
 * A customer session landing here (shouldn't normally happen, but e.g. an
 * old bookmark) bounces to /dashboard instead — the two views are kept
 * strictly separate.
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
  if (session.user.role === "customer") redirect(homeForRole(session.user.role));

  return children;
}
