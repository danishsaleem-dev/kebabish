import { siteConfig } from "@/lib/site-config";
import type { PublicMenuCategory } from "@/lib/public-menu";

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
    name: `${siteConfig.brandName} menu`,
    url: menuUrl,
    inLanguage: locale,
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      name: category.label,
      description: category.description || undefined,
      hasMenuItem: category.items.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        url: `${menuUrl}/${item.slug}`,
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

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
