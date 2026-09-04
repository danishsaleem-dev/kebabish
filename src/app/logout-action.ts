"use server";

import { signOut } from "@/lib/auth";

/** Shared by the admin sidebar and the customer dashboard. */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
