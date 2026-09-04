import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";
import { isComingSoonEnabled } from "@/lib/site-gate";

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

export default function sitemap(): MetadataRoute.Sitemap {
  if (isComingSoonEnabled()) {
    // Only the coming-soon page is actually reachable right now — listing
    // the real pages here while they 307-redirect away would just teach
    // Google to distrust the sitemap.
    return localizedEntries(["/coming-soon"], {
      priority: () => 1,
      changeFrequency: () => "weekly",
    });
  }

  return localizedEntries(["", "/menu", "/contact"], {
    priority: (path) => (path === "" ? 1 : 0.7),
    changeFrequency: (path) => (path === "" ? "weekly" : "monthly"),
  });
}
