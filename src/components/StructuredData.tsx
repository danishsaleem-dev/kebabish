import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/lib/site-config";
import { getPublicSettings } from "@/lib/admin/store";
import { reviews } from "@/lib/reviews-data";
import { absoluteUrl, BUSINESS_ID } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * The site-wide business entity. Rendered once in `[locale]/layout.tsx`, so it
 * is on every page — expected, the same as a footer address. Everything else
 * (WebSite, page types, the menu, products, the FAQ) points back at it by
 * `@id` instead of repeating it.
 *
 * Only facts that are already public on the site go in here. The registered
 * company name ("Marfah Enterprise") is deliberately not one of them: the
 * public site names it on Privacy and Terms only, and structured data is
 * public-facing copy like any other.
 */
export default async function StructuredData({ locale }: { locale: string }) {
  const [settings, t] = await Promise.all([
    getPublicSettings(),
    getTranslations({ locale, namespace: "seo" }),
  ]);

  const openingHoursSpecification = settings.hours
    .filter((h) => !h.closed)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[h.day],
      opens: h.opens,
      closes: h.closes,
    }));

  const kitchen = {
    "@type": "GeoCoordinates",
    latitude: siteConfig.coordinates.lat,
    longitude: siteConfig.coordinates.lng,
  };

  const data = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "@id": BUSINESS_ID,
    name: siteConfig.brandName,
    description: t("homeDescription"),
    slogan: siteConfig.tagline[locale === "nl" ? "nl" : "en"],
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
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      postalCode: siteConfig.address.postalCode,
      addressLocality: siteConfig.address.city,
      addressCountry: siteConfig.address.country,
    },
    geo: kitchen,
    // The advertised radius, plus each town by name — a searcher for
    // "Pakistaans eten bezorgen Enkhuizen" is matched on the place name, not
    // on a circle of coordinates.
    areaServed: [
      {
        "@type": "GeoCircle",
        geoMidpoint: kitchen,
        geoRadius: siteConfig.deliveryRadiusKm * 1000,
      },
      ...siteConfig.deliveryAreaTowns.map((town) => ({
        "@type": "City",
        name: town.name,
      })),
    ],
    sameAs: [
      siteConfig.socials.instagram,
      siteConfig.socials.facebook,
      siteConfig.socials.tiktok,
      siteConfig.socials.threads,
    ],
    // Chamber of Commerce number (public in the footer) and, once the owner has
    // entered it in Settings, the VAT id — both help a search engine tie the
    // listing to the registered business.
    identifier: {
      "@type": "PropertyValue",
      propertyID: "KVK",
      value: siteConfig.kvkNumber,
    },
    ...(settings.vatNumber ? { vatID: settings.vatNumber } : {}),
    hasMenu: absoluteUrl(locale, "/menu"),
    acceptsReservations: false,
    // How ordering works, in the vocabulary Google reads for restaurants: an
    // order action on the menu page, fulfilled by our own riders. This replaces
    // `hasDeliveryMethod`, which is not a valid property of a business — it
    // belongs to DeliveryEvent/ParcelDelivery — and was ignored (and flagged by
    // validators) rather than conveying "delivery only".
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl(locale, "/menu"),
        inLanguage: locale === "nl" ? "nl-NL" : "en",
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
    },
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

  return <JsonLd data={data} />;
}
