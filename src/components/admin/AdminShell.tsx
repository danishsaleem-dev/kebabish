import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import AdminShellClient from "@/components/admin/AdminShellClient";

export interface SessionUser {
  name: string;
  email: string;
  role: "owner" | "staff";
}

/**
 * Server wrapper: reads the session and hands it to the client shell.
 *
 * Every page under `/admin/(dashboard)` calls this exactly as before
 * (`<AdminShell title="...">...</AdminShell>`) — the props didn't change,
 * so none of those ~20 call sites needed touching when auth was added.
 * The `(dashboard)/layout.tsx` guard already redirects unauthenticated
 * requests before any page body runs, so `user` is only undefined here in
 * the (unreachable in practice) case of the session expiring mid-render.
 */
export default async function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const session = await auth();

  // Narrows the broader `Role` (which also includes "customer") down to
  // what this shell actually renders for — the (dashboard) layout guard
  // already guarantees this at runtime, but TypeScript can't see across
  // that boundary, so it's re-asserted here.
  const user =
    session?.user && session.user.role !== "customer"
      ? {
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }
      : undefined;

  return (
    <AdminShellClient title={title} user={user}>
      {children}
    </AdminShellClient>
  );
}
