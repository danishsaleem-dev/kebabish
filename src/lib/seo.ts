import { routing } from "@/i18n/routing";

/**
 * Per-page canonical + hreflang alternates.
 *
 * Every page under `[locale]/(site)` used to inherit whatever `alternates`
 * the root `[locale]/layout.tsx` set — which only ever describes the
 * locale *root* ("/" or "/en"). A page's own `generateMetadata` that
 * doesn't set `alternates` itself gets that value verbatim, so every page
 * on the site was silently telling Google its canonical URL was the
 * homepage. `path` is locale-independent and starts with "/" (e.g.
 * "/menu", "/menu/chicken-biryani", "" for the homepage itself).
 */
export function localeAlternates(locale: string, path: string) {
  const localised = (loc: string) =>
    loc === routing.defaultLocale ? path || "/" : `/${loc}${path}`;

  return {
    canonical: localised(locale),
    languages: Object.fromEntries(
      routing.locales.map((loc) => [loc, localised(loc)])
    ),
  };
}
