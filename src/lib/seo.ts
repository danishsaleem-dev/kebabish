import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";

/** Stable schema.org `@id`s, so separate JSON-LD blocks can point at each other. */
export const BUSINESS_ID = `${siteConfig.website}/#business`;
export const WEBSITE_ID = `${siteConfig.website}/#website`;

/** Absolute URL of a locale-independent path ("/menu", "" for the homepage). */
export function absoluteUrl(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${siteConfig.website}${prefix}${path}`;
}

/**
 * The WebSite node, inline. Other schemas (`isPartOf`) embed this rather than
 * pointing at the id alone: Google reads each page's JSON-LD on its own, and
 * the full WebSite block only ships on the homepage, so a bare `{"@id"}`
 * reference from /menu or /about would point at something not on that page.
 */
export function websiteNode(locale: string) {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl(locale, ""),
    name: siteConfig.brandName,
  };
}

/** BCP-47 tag for `inLanguage` in structured data. */
export function languageTag(locale: string): string {
  return locale === "nl" ? "nl-NL" : "en";
}

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
 *
 * `x-default` is what Google serves to a searcher whose language matches
 * neither version; pointing it at the default (Dutch) locale is the standard
 * choice for a site whose audience is local.
 */
export function localeAlternates(locale: string, path: string) {
  const localised = (loc: string) =>
    loc === routing.defaultLocale ? path || "/" : `/${loc}${path}`;

  return {
    canonical: localised(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((loc) => [loc, localised(loc)])),
      "x-default": localised(routing.defaultLocale),
    },
  };
}

const DEFAULT_OG_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630 };

/**
 * Everything a page's `<head>` needs, in one place: title, description,
 * canonical/hreflang, Open Graph and Twitter.
 *
 * **Why this exists:** Next merges metadata one top-level key at a time, so a
 * page that sets any `openGraph` field replaces the layout's whole object —
 * and one that sets none inherits the layout's verbatim. Before this helper
 * every inner page told Facebook, WhatsApp and LinkedIn that its title was
 * "Kebabish Hoogkarspel" and its URL was the homepage (the same trap
 * `localeAlternates` closes for canonicals). A link to /menu shared in
 * WhatsApp previewed as the homepage. Passing everything through here means
 * a page can't forget one.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  image,
  noindex = false,
}: {
  locale: string;
  /** Locale-independent, e.g. "/menu"; "" for the homepage. */
  path: string;
  title: string;
  description?: string;
  /** Use `title` as-is instead of appending " | Kebabish" (the homepage). */
  absoluteTitle?: boolean;
  /** A page-specific share image (a dish photo). Defaults to the brand card. */
  image?: { url: string; alt: string };
  noindex?: boolean;
}): Metadata {
  const alternates = localeAlternates(locale, path);
  const fullTitle = absoluteTitle ? title : `${title} | ${siteConfig.brandName}`;
  const og = image
    ? [{ url: image.url, alt: image.alt }]
    : [{ ...DEFAULT_OG_IMAGE, alt: fullTitle }];
  const otherLocales = routing.locales.filter((l) => l !== locale);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    ...(description ? { description } : {}),
    alternates,
    openGraph: {
      type: "website",
      siteName: siteConfig.brandName,
      title: fullTitle,
      ...(description ? { description } : {}),
      url: alternates.canonical,
      locale: locale === "nl" ? "nl_NL" : "en_US",
      alternateLocale: otherLocales.map((l) => (l === "nl" ? "nl_NL" : "en_US")),
      images: og,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      ...(description ? { description } : {}),
      images: og.map((i) => i.url),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Trim to what Google shows in a snippet (~155–160 characters) without
 * cutting a word in half.
 */
export function snippet(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}
