"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
 * Which language to answer in. The dashboard sits outside `[locale]`, so
 * there is nothing in the URL to read: every form posts a hidden `locale`
 * (the same approach the signup action takes). An unexpected value falls
 * back to Dutch rather than throwing — a mangled field must not cost
 * someone their edit.
 */
async function translate(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "nl";
  return getTranslations({ locale, namespace: "account" });
}

/** Both the overview and the account page show this data, so the whole segment is refreshed. */
function refresh() {
  revalidatePath("/dashboard", "layout");
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
  const t = await translate(formData);
  const id = await customerId();
  if (!id) return { ok: false, message: t("msgSignInAgain") };

  const optIn = formData.get("marketingOptIn") === "on";
  try {
    await setMarketingConsent(id, optIn, "dashboard");
  } catch (error) {
    console.error("[dashboard] could not save the marketing preference:", error);
    return { ok: false, message: t("msgSaveFailed") };
  }

  refresh();
  return { ok: true, message: t(optIn ? "msgMarketingOn" : "msgMarketingOff") };
}

export async function removeSavedAddressAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await translate(formData);
  const id = await customerId();
  if (!id) return { ok: false, message: t("msgSignInAgain") };

  try {
    await clearCustomerAddress(id);
  } catch (error) {
    console.error("[dashboard] could not remove the saved address:", error);
    return { ok: false, message: t("msgAddressFailed") };
  }

  refresh();
  return { ok: true, message: t("msgAddressRemoved") };
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

/** Change name and phone. The email address is the account's identity and stays as it is. */
export async function updateProfileAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await translate(formData);
  const id = await customerId();
  if (!id) return { ok: false, message: t("msgSignInAgain") };

  const schema = z.object({
    name: z.string().trim().min(2, t("errName")).max(80, t("errNameLong")),
    phone: z.string().trim().max(30, t("errPhoneLong")).default(""),
  });

  const parsed = schema.safeParse({
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
    if (!phone) return { ok: false, errors: { phone: t("errPhone") } };
  }

  try {
    await updateCustomerProfile(id, { name: parsed.data.name, phone });
  } catch (error) {
    console.error("[dashboard] could not save the profile:", error);
    return { ok: false, message: t("msgSaveFailed") };
  }
  refresh();
  return { ok: true, message: t("msgSaved") };
}

/** Change the password, for someone who knows the current one. */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await translate(formData);
  const id = await customerId();
  if (!id) return { ok: false, message: t("msgSignInAgain") };

  const schema = z
    .object({
      current: z.string().min(1, t("errPasswordCurrent")),
      password: z.string().min(8, t("errPasswordShort")),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      message: t("errPasswordMatch"),
      path: ["confirm"],
    });

  const parsed = schema.safeParse({
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
  if (!passwordTries(id)) return { ok: false, message: t("msgPasswordTooMany") };

  try {
    const result = await changeCustomerPassword(id, parsed.data.current, parsed.data.password);
    if (result === "wrong") return { ok: false, errors: { current: t("msgPasswordWrong") } };
    if (result === "none") return { ok: false, message: t("msgPasswordNone") };
  } catch (error) {
    console.error("[dashboard] could not change the password:", error);
    return { ok: false, message: t("msgPasswordFailed") };
  }
  return { ok: true, message: t("msgPasswordChanged") };
}

/** "Send it again": the choose-your-password email, for an account that has no password yet. */
export async function resendSetupEmailAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await translate(formData);
  const id = await customerId();
  if (!id) return { ok: false, message: t("msgSignInAgain") };
  if (!setupEmails(id)) return { ok: false, message: t("msgSetupTooSoon") };

  try {
    const account = await getCustomerAccountState(id);
    if (!account || !account.passwordless) {
      return { ok: true, message: t("msgAlreadyConfirmed") };
    }
    const token = await createAccountSetupToken(id);
    if (!token) return { ok: false, message: t("msgSetupFailed") };

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
    return { ok: false, message: t("msgSetupFailed") };
  }
  return { ok: true, message: t("msgSetupSent") };
}
