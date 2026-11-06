import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";

export type AccountLocale = "nl" | "en";

/**
 * The customer dashboard lives outside the `[locale]` routing (its own
 * `<html>`, like /admin and /login), so nothing in the URL says which
 * language to use. It is decided here, in this order:
 *
 *  1. the cookie — the customer picked a language on the Account page, and
 *     that choice has to survive every link inside the dashboard, which is
 *     why this is a cookie rather than a `?lang=` on all of them;
 *  2. the language of their latest order — the same fallback the customer
 *     emails use (see rewards.ts), since accounts don't store a language;
 *  3. Dutch, the site's default.
 *
 * Deliberately *not* `?lang=` or the referrer, the way /login does it: the
 * layout renders the navigation and can read neither a page's search params
 * nor a referrer that stays stable as the customer moves between the four
 * dashboard pages, so either one would have the chrome and the page
 * disagreeing, or the language flipping on the second click. Both inputs
 * here are the same on every page.
 */
const COOKIE = "kebabish-account-lang";

function clean(value: string | undefined | null): AccountLocale | null {
  return value === "nl" || value === "en" ? value : null;
}

export async function accountLocale(customerId?: string): Promise<AccountLocale> {
  const chosen = clean((await cookies()).get(COOKIE)?.value);
  if (chosen) return chosen;

  if (customerId) {
    const ordered = await latestOrderLocale(customerId).catch(() => null);
    if (ordered) return ordered;
  }

  return "nl";
}

/** The language of the customer's most recent order, if they have one. */
async function latestOrderLocale(customerId: string): Promise<AccountLocale | null> {
  const { data } = await supabaseAdmin()
    .from("orders")
    .select("locale")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);
  return clean(data?.[0]?.locale);
}

/** The cookie name, for the action that writes it. */
export const ACCOUNT_LOCALE_COOKIE = COOKIE;

/** Locale-aware number formatting, used for points totals throughout the dashboard. */
export function accountNumber(locale: AccountLocale): (value: number) => string {
  const tag = locale === "nl" ? "nl-NL" : "en-GB";
  return (value: number) => value.toLocaleString(tag);
}

/** The `/en` prefix a public-site link needs in this language. Dutch has none. */
export function sitePrefix(locale: AccountLocale): string {
  return locale === "en" ? "/en" : "";
}
