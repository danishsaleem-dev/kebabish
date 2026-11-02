import { siteConfig } from "@/lib/site-config";
import { BUSINESS_ID, absoluteUrl } from "@/lib/seo";
import type { PublicDeal } from "@/lib/public-deals";
import JsonLd from "@/components/JsonLd";

/** schema.org `Product` for a deal page, on the same rules as a dish's (see ProductSchema). */
export default function DealSchema({
  locale,
  deal,
  description,
}: {
  locale: string;
  deal: PublicDeal;
  description: string;
}) {
  const url = absoluteUrl(locale, `/deals/${deal.slug}`);
  const images = deal.images.map((src) => (src.startsWith("http") ? src : `${siteConfig.website}${src}`));

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${url}#product`,
        url,
        name: deal.name,
        description,
        sku: `deal-${deal.slug}`,
        ...(images.length > 0 ? { image: images } : {}),
        brand: { "@type": "Brand", name: siteConfig.brandName },
        offers: {
          "@type": "Offer",
          url,
          price: deal.price.toFixed(2),
          priceCurrency: "EUR",
          availability: deal.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": BUSINESS_ID },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: siteConfig.address.country,
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
          },
        },
      }}
    />
  );
}
