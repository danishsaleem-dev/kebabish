import { siteConfig } from "@/lib/site-config";
import { BUSINESS_ID, WEBSITE_ID, absoluteUrl, languageTag } from "@/lib/seo";
import { routing } from "@/i18n/routing";
import JsonLd from "@/components/JsonLd";

/**
 * The `WebSite` entity — homepage only, which is where Google looks for it
 * (it is what feeds the site name shown above a result). Points at the
 * business as its publisher so the two are understood as one thing.
 *
 * No `SearchAction`: the site has no search endpoint a crawler could use, and
 * declaring one that does not exist is worse than leaving it out.
 */
export default function HomeSchema({ locale }: { locale: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl(locale, ""),
    name: siteConfig.brandName,
    alternateName: `${siteConfig.brandName} ${siteConfig.address.city}`,
    inLanguage: routing.locales.map(languageTag),
    publisher: { "@id": BUSINESS_ID },
  };

  return <JsonLd data={data} />;
}
