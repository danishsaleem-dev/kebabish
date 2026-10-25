"use server";

import { revalidatePath } from "next/cache";
import { getCustomerSession } from "@/lib/customers/session";
import { z } from "zod";
import {
  changeCustomerPassword,
  clearCustomerAddress,
  getCustomerAccountState,
  setMarketingConsent,
  updateCustomerProfile,
} from "@/lib/customers/accounts";
import { createAccountSetupToken } from "@/lib/password-reset";
import { sendAccountSetupEmail } from "@/lib/email/account-setup";
import { normalizeDutchPhone } from "@/lib/phone";
import { siteConfig } from "@/lib/site-config";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/** The signed-in customer's id, or null — these actions are for customers only. */
async function customerId(): Promise<string | null> {
  return (await getCustomerSession())?.user.id ?? null;
}

/**
 * The "email me offers" switch on the account page. The checkbox is the only
 * thing that can turn it on, and the customer can always turn it off here —
 * withdrawing is as easy as giving it.
 */
export async function updateMarketingAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  const optIn = formData.get("marketingOptIn") === "on";
  try {
    await setMarketingConsent(id, optIn, "dashboard");
  } catch (error) {
    console.error("[dashboard] could not save the marketing preference:", error);
    return { ok: false, message: "Couldn't save that — please try again." };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: optIn
      ? "Saved — we'll email you news and offers."
      : "Saved — we won't email you news or offers.",
  };
}

export async function removeSavedAddressAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  try {
    await clearCustomerAddress(id);
  } catch (error) {
    console.error("[dashboard] could not remove the saved address:", error);
    return { ok: false, message: "Couldn't remove it — please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Your saved address was removed." };
}

/* ---------------------------------------------------------------- profile */

/** Tiny in-memory throttle (per server instance): `max` tries per `windowMs` per key. */
function makeThrottle(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    return true;
  };
}
const passwordTries = makeThrottle(5, 10 * 60_000);
const setupEmails = makeThrottle(1, 60_000);

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Keep your name under 80 characters."),
  phone: z.string().trim().max(30, "That phone number is too long.").default(""),
});

/** Change name and phone. The email address is the account's identity and stays as it is. */
export async function updateProfileAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }

  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizeDutchPhone(parsed.data.phone);
    if (!phone) return { ok: false, errors: { phone: "That doesn't look like a Dutch phone number." } };
  }

  try {
    await updateCustomerProfile(id, { name: parsed.data.name, phone });
  } catch (error) {
    console.error("[dashboard] could not save the profile:", error);
    return { ok: false, message: "Couldn't save that — please try again." };
  }
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Password needs to be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords don't match.",
    path: ["confirm"],
  });

/** Change the password, for someone who knows the current one. */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }

  // Someone with a borrowed, signed-in browser must not be able to guess the password.
  if (!passwordTries(id)) {
    return { ok: false, message: "Too many tries. Wait a few minutes and try again." };
  }

  try {
    const result = await changeCustomerPassword(id, parsed.data.current, parsed.data.password);
    if (result === "wrong") return { ok: false, errors: { current: "That isn't your current password." } };
    if (result === "none") return { ok: false, message: "Choose your password from the email we sent you." };
  } catch (error) {
    console.error("[dashboard] could not change the password:", error);
    return { ok: false, message: "Couldn't change it — please try again." };
  }
  return { ok: true, message: "Your password has been changed." };
}

/** "Send it again": the choose-your-password email, for an account that has no password yet. */
export async function resendSetupEmailAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };
  if (!setupEmails(id)) {
    return { ok: false, message: "We just sent it — give it a minute, and check your spam folder." };
  }

  try {
    const account = await getCustomerAccountState(id);
    if (!account || !account.passwordless) return { ok: true, message: "Your account is already confirmed." };
    const token = await createAccountSetupToken(id);
    if (!token) return { ok: false, message: "Couldn't send it — please try again." };

    // The language of their latest order, like the other customer emails.
    const { data: latest } = await supabaseAdmin()
      .from("orders")
      .select("locale")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await sendAccountSetupEmail({
      to: account.email,
      name: account.name,
      setupUrl: `${siteConfig.website}/reset-password?token=${encodeURIComponent(token)}`,
      locale: latest?.locale ?? "nl",
    });
  } catch (error) {
    console.error("[dashboard] could not resend the setup email:", error);
    return { ok: false, message: "Couldn't send it — please try again." };
  }
  return { ok: true, message: "Sent. Check your inbox (and spam folder)." };
}
