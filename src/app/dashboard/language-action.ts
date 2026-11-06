"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_LOCALE_COOKIE } from "@/lib/account-page";

/** A year — long enough that the choice feels permanent, short enough to lapse. */
const MAX_AGE = 365 * 24 * 60 * 60;

/** Only the dashboard's own paths, so a crafted `back` can't bounce the customer off-site. */
function safePath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return /^\/dashboard(\/[A-Za-z0-9\-/]*)?$/.test(path) ? path : "/dashboard";
}

/**
 * The NL/EN switch on the Account page. The dashboard has no locale in its
 * URLs (see lib/account-page.ts), so the choice is a cookie — written here,
 * because a cookie can only be set from an action or a route handler, never
 * while a page renders.
 */
export async function setAccountLanguageAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale") === "en" ? "en" : "nl";
  (await cookies()).set(ACCOUNT_LOCALE_COOKIE, locale, {
    maxAge: MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(safePath(formData.get("back")));
}
