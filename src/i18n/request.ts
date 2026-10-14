import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { getMergedMessages } from "@/lib/content/messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const defaults = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    // The shipped text, with whatever the owner has changed in /admin/content
    // laid over it. Identical to `defaults` when nothing is edited or the
    // database is unreachable — see lib/content/store.ts.
    messages: await getMergedMessages(locale as "nl" | "en", defaults),
  };
});
