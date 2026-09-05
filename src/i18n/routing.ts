import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["nl", "en"],
  defaultLocale: "nl",
  localePrefix: "as-needed",
  // Without this, next-intl's middleware picks a locale from the visitor's
  // browser (Accept-Language) on their first visit, so an English-language
  // browser lands on /en even though Dutch is meant to be the default for
  // everyone. Danish's customers are Dutch first; language is something
  // they switch to, not something guessed from browser settings.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
