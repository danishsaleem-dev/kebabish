import { siteConfig } from "@/lib/site-config";
import { getPublicSettings } from "@/lib/admin/store";
import { reviews } from "@/lib/reviews-data";

const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function StructuredData({ locale }: { locale: string }) {
  const settings = await getPublicSettings();
  const openingHoursSpecification = settings.hours
    .filter((h) => !h.closed)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[h.day],
      opens: h.opens,
      closes: h.closes,
    }));

  const data = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "@id": `${siteConfig.website}/#business`,
    name: siteConfig.brandName,
    image: `${siteConfig.website}/og-image.jpg`,
    // Google's logo guidance wants a self-contained square mark, not a
    // wordmark on transparent — this is the one already used for the
    // favicon/app icons for the same reason.
    logo: `${siteConfig.website}/logo/favicon-kebabish.png`,
    url: siteConfig.website,
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    servesCuisine: "Pakistani",
    priceRange: "€€",
    currenciesAccepted: "EUR",
    // Mollie is the payment processor (see CLAUDE.md) — these are the
    // real methods it offers, not a guess.
    paymentAccepted: "iDEAL, Credit Card, Apple Pay, Google Pay, Klarna",
    hasDeliveryMethod: "https://schema.org/OnlineDelivery",
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
    acceptsReservations: false,
    openingHoursSpecification,
    // Only present once real reviews exist (src/lib/reviews-data.ts is
    // seeded empty — never invented) — a rating with nothing behind it
    // is exactly the kind of thing Google's review-snippet guidelines
    // penalise, so this has to earn its way in with real data.
    ...(reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            ).toFixed(1),
            reviewCount: reviews.length,
          },
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
            },
            reviewBody: r.text,
          })),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
