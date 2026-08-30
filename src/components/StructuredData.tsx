import { siteConfig } from "@/lib/site-config";

export default function StructuredData({ locale }: { locale: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: siteConfig.brandName,
    legalName: siteConfig.companyName,
    image: `${siteConfig.website}/og-image.jpg`,
    url: siteConfig.website,
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    servesCuisine: "Pakistani",
    priceRange: "€€",
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      postalCode: siteConfig.address.postalCode,
      addressLocality: siteConfig.address.city,
      addressCountry: siteConfig.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.coordinates.lat,
      longitude: siteConfig.coordinates.lng,
    },
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: siteConfig.coordinates.lat,
        longitude: siteConfig.coordinates.lng,
      },
      geoRadius: siteConfig.deliveryRadiusKm * 1000,
    },
    sameAs: [
      siteConfig.socials.instagram,
      siteConfig.socials.facebook,
      siteConfig.socials.tiktok,
      siteConfig.socials.threads,
    ],
    hasMenu: `${siteConfig.website}/${locale === "nl" ? "" : "en/"}menu`,
    acceptsReservations: "False",
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
