import { siteConfig } from "@/lib/site-config";
import { routing } from "@/i18n/routing";

/**
 * schema.org BreadcrumbList — lets Google show the page's place in the
 * site hierarchy in search results instead of just a bare URL. `items`
 * excludes Home; it's always prepended here so every caller doesn't repeat
 * it. `path` is locale-independent, e.g. "/menu" or "/menu/chicken-biryani".
 */
export default function BreadcrumbSchema({
  locale,
  items,
}: {
  locale: string;
  items: { name: string; path: string }[];
}) {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = (path: string) => `${siteConfig.website}${prefix}${path}`;

  const trail = [{ name: "Home", path: "" }, ...items];

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: url(crumb.path),
    })),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
