"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, homeForRole, signIn } from "@/lib/auth";
import { countAdminUsers, createAdminUser } from "@/lib/admin/auth-users";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  try {
    // redirect: false so we get control back instead of Auth.js redirecting
    // straight to the default page — the destination depends on the role,
    // which we only know once the session exists below.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      return { ok: false, message: "Incorrect email or password." };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: "Incorrect email or password." };
    }
    throw error;
  }

  const session = await auth();
  redirect(homeForRole(session?.user.role ?? "customer"));
}

/**
 * Creates the very first admin account. Only works while `admin_users` is
 * empty — the page only shows this form in that state, but the check is
 * re-run here since the client can't be trusted to enforce it. Unrelated to
 * customer signups (those go through /signup and the `customers` table).
 */
export async function bootstrapOwnerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const existing = await countAdminUsers();
  if (existing > 0) {
    return {
      ok: false,
      message: "An account already exists — sign in instead.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email) {
    return { ok: false, message: "Fill in your name and email." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password needs to be at least 8 characters." };
  }

  await createAdminUser({ name, email, password, role: "owner" });

  try {
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      return {
        ok: false,
        message: "Account created — sign in with your new password.",
      };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message: "Account created — sign in with your new password.",
      };
    }
    throw error;
  }

  redirect("/admin");
}
