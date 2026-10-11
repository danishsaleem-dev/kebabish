import type { MetadataRoute } from "next";
import { reviews } from "@/lib/reviews-data";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";
import { isComingSoonEnabled } from "@/lib/site-gate";
import { getPublicItemSlugs } from "@/lib/public-menu";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

function localizedEntries(
  paths: string[],
  opts: {
    priority: (path: string) => number;
    changeFrequency: (path: string) => ChangeFrequency;
  }
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const urlFor = (locale: string, path: string) =>
    `${siteConfig.website}${locale === routing.defaultLocale ? "" : `/${locale}`}${path}`;

  for (const path of paths) {
    // Every entry lists all its language versions (and x-default), the same
    // set the page's own <link rel="alternate"> tags declare — Google reads
    // either, and having both agree is what makes the pairing trusted.
    const languages = {
      ...Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)])),
      "x-default": urlFor(routing.defaultLocale, path),
    };
    for (const locale of routing.locales) {
      entries.push({
        url: urlFor(locale, path),
        // No `lastModified` on purpose. It used to be `new Date()`, i.e. "every
        // page changed just now" on every request — a claim Google learns to
        // distrust and then ignores for the whole site. We have no real
        // per-page modification time to report, so we report none.
        changeFrequency: opts.changeFrequency(path),
        priority: opts.priority(path),
        alternates: { languages },
      });
    }
  }
  return entries;
}

const STATIC_PAGES = [
  "",
  "/menu",
  "/about",
  "/contact",
  "/catering",
  "/delivery-areas",
  "/reviews",
  "/privacy",
  "/terms",
];

// These rank lower and change less often than the pages a customer or
// Google actually cares about ranking well.
const LOW_PRIORITY = new Set(["/privacy", "/terms"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isComingSoonEnabled()) {
    // Only the coming-soon page is actually reachable right now — listing
    // the real pages here while they 307-redirect away would just teach
    // Google to distrust the sitemap.
    return localizedEntries(["/coming-soon"], {
      priority: () => 1,
      changeFrequency: () => "weekly",
    });
  }

  // /reviews is an empty "coming soon" page until real reviews exist —
  // not worth asking Google to index.
  const pages = reviews.length > 0 ? STATIC_PAGES : STATIC_PAGES.filter((p) => p !== "/reviews");
  const staticEntries = localizedEntries(pages, {
    priority: (path) => {
      if (path === "") return 1;
      if (path === "/menu") return 0.9;
      if (LOW_PRIORITY.has(path)) return 0.3;
      return 0.7;
    },
    changeFrequency: (path) => {
      if (path === "" || path === "/menu") return "weekly";
      if (LOW_PRIORITY.has(path)) return "yearly";
      return "monthly";
    },
  });

  // One entry per dish, so a search for a specific dish can land straight
  // on it — same reason SEO is priority #1 across the rest of this file.
  // Wrapped in try/catch: a store hiccup here should degrade to "just the
  // static pages" rather than 500 the whole sitemap.
  let dishSlugs: string[] = [];
  try {
    dishSlugs = await getPublicItemSlugs();
  } catch (error) {
    console.error("[sitemap] could not load dish slugs:", error);
  }

  const dishEntries = localizedEntries(
    dishSlugs.map((slug) => `/menu/${slug}`),
    { priority: () => 0.6, changeFrequency: () => "weekly" }
  );

  return [...staticEntries, ...dishEntries];
}
