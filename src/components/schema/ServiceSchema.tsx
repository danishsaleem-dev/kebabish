import { siteConfig } from "@/lib/site-config";
import { BUSINESS_ID, absoluteUrl, languageTag } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/**
 * A service the business offers — food delivery, or catering — with the area
 * it covers. These are the two pages people reach by searching for a service
 * plus a place ("Pakistaanse catering Hoogkarspel"), so the place names are
 * spelled out rather than left to a circle of coordinates.
 */
export default function ServiceSchema({
  locale,
  path,
  name,
  serviceType,
  description,
}: {
  locale: string;
  path: string;
  name: string;
  serviceType: string;
  description: string;
}) {
  const url = absoluteUrl(locale, path);
  const kitchen = {
    "@type": "GeoCoordinates",
    latitude: siteConfig.coordinates.lat,
    longitude: siteConfig.coordinates.lng,
  };

  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    url,
    name,
    serviceType,
    description,
    inLanguage: languageTag(locale),
    provider: { "@id": BUSINESS_ID },
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
  };

  return <JsonLd data={data} />;
}
