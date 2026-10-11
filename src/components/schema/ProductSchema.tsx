import { siteConfig } from "@/lib/site-config";
import { BUSINESS_ID, absoluteUrl } from "@/lib/seo";
import type { PublicMenuItem } from "@/lib/public-menu";
import JsonLd from "@/components/JsonLd";

/**
 * schema.org `Product` for one dish page — what makes a dish eligible for the
 * price/availability/photo treatment in search results. (`/menu` carries
 * `Menu`/`MenuItem` for the whole listing; this is the per-page counterpart.)
 *
 * Nothing is invented. A dish with no sellable price ships **without** an
 * `offers` block, exactly as the menu schema does — a product priced "€0.01"
 * or an unpriced one must never read as purchasable. Sold-out is stated as
 * out of stock rather than left looking orderable. Photos are the dish's own
 * uploads, all of them, in admin order.
 *
 * The return policy is a statement of fact from the Terms: freshly prepared
 * food has no 14-day withdrawal right, so returns are not permitted.
 */
export default function ProductSchema({
  locale,
  item,
  category,
  description,
}: {
  locale: string;
  item: PublicMenuItem;
  category: string;
  /** The text to describe the dish with (already localised). */
  description: string;
}) {
  const url = absoluteUrl(locale, `/menu/${item.slug}`);
  const images = item.images.map((src) =>
    src.startsWith("http") ? src : `${siteConfig.website}${src}`
  );

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: item.name,
    description,
    sku: item.slug,
    category,
    ...(images.length > 0 ? { image: images } : {}),
    brand: { "@type": "Brand", name: siteConfig.brandName },
    ...(item.price != null
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: item.price.toFixed(2),
            priceCurrency: "EUR",
            availability: item.soldOut
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": BUSINESS_ID },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: siteConfig.address.country,
              returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
            },
          },
        }
      : {}),
  };

  return <JsonLd data={data} />;
}
