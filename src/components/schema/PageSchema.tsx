import { BUSINESS_ID, absoluteUrl, languageTag, websiteNode } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/**
 * A typed `WebPage` for pages that have a more specific meaning than "a page":
 * About, Contact, and the menu listing. It ties the page to the site
 * (`isPartOf`) and to the business (`about` / `mainEntity`), which is what
 * lets a search engine connect "this is the contact page of that restaurant"
 * to the entity in the site-wide block.
 */
export default function PageSchema({
  locale,
  path,
  type,
  name,
  description,
}: {
  locale: string;
  /** Locale-independent, e.g. "/about". */
  path: string;
  type: "AboutPage" | "ContactPage" | "CollectionPage";
  name: string;
  description: string;
}) {
  const url = absoluteUrl(locale, path);

  const data = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: languageTag(locale),
    isPartOf: websiteNode(locale),
    // A contact page is *about* how to reach the business, so the business is
    // its main entity; an about page and a listing page are about it.
    ...(type === "ContactPage"
      ? { mainEntity: { "@id": BUSINESS_ID } }
      : { about: { "@id": BUSINESS_ID } }),
  };

  return <JsonLd data={data} />;
}
