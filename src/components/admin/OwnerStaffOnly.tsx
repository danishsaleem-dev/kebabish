import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Drop this in as the default export of a `layout.tsx` to close off an
 * entire admin subtree to a manager session — every page and nested route
 * under it inherits the guard for free. The outer `(dashboard)/layout.tsx`
 * already guarantees owner/staff/manager by the time this runs, so the
 * only thing left to check here is manager specifically.
 */
export default async function OwnerStaffOnly({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (session?.user.role === "manager") redirect("/admin");

  return children;
}
