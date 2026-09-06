import type { MetadataRoute } from "next";
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
  for (const path of paths) {
    for (const locale of routing.locales) {
      const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
      entries.push({
        url: `${siteConfig.website}${prefix}${path}`,
        lastModified: new Date(),
        changeFrequency: opts.changeFrequency(path),
        priority: opts.priority(path),
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

  const staticEntries = localizedEntries(STATIC_PAGES, {
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
