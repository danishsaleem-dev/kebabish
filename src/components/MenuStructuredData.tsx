import { siteConfig } from "@/lib/site-config";
import type { PublicMenuCategory } from "@/lib/public-menu";
import { BUSINESS_ID } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/**
 * schema.org Menu/MenuSection/MenuItem for the /menu page — separate from
 * the site-wide FoodEstablishment block in StructuredData.tsx, which only
 * points at this page via `hasMenu` rather than embedding the whole thing
 * (keeps that block small and this one only rendered where it's relevant).
 *
 * A dish with no price yet (menu prices are still being entered — see
 * CLAUDE.md) is included without an `offers` block rather than inventing
 * one; a sold-out dish is marked unavailable via `offers.availability`
 * instead of being left looking orderable.
 */
export default function MenuStructuredData({
  categories,
  locale,
}: {
  categories: PublicMenuCategory[];
  locale: string;
}) {
  if (categories.length === 0) return null;

  const menuUrl = `${siteConfig.website}${locale === "nl" ? "" : "/en"}/menu`;

  const data = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${menuUrl}#menu`,
    name: `${siteConfig.brandName} menu`,
    url: menuUrl,
    inLanguage: locale,
    // Ties the menu to the business it belongs to; the business block points
    // back at this page through `hasMenu`.
    provider: { "@id": BUSINESS_ID },
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      name: category.label,
      description: category.description || undefined,
      hasMenuItem: category.items.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        url: `${menuUrl}/${item.slug}`,
        "@id": `${menuUrl}/${item.slug}#menuitem`,
        ...(item.image ? { image: item.image } : {}),
        suitableForDiet: item.vegetarian
          ? "https://schema.org/VegetarianDiet"
          : undefined,
        ...(item.price != null
          ? {
              offers: {
                "@type": "Offer",
                price: item.price.toFixed(2),
                priceCurrency: "EUR",
                availability: item.soldOut
                  ? "https://schema.org/SoldOut"
                  : "https://schema.org/InStock",
              },
            }
          : {}),
      })),
    })),
  };

  return <JsonLd data={data} />;
}
