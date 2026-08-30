/**
 * Central source of truth for all business/brand facts used across the
 * site (metadata, JSON-LD structured data, footer, contact page, WhatsApp
 * links, etc). Keep this the single place these values live.
 */

export const siteConfig = {
  companyName: "Marfah Enterprise",
  brandName: "Kebabish",
  tagline: {
    nl: "De Smaak van Thuis",
    en: "The Taste of Home",
  },
  kvkNumber: "42147417",

  address: {
    street: "De Overstoep 49",
    postalCode: "1616RK",
    city: "Hoogkarspel",
    country: "NL",
    countryName: "Nederland",
  },

  // TODO: geocode the exact address once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is
  // set up, and replace these with the precise coordinates. Approximate
  // Hoogkarspel center used as a placeholder so the map/distance code has
  // something to render against in the meantime.
  coordinates: {
    lat: 52.6997,
    lng: 5.068,
  },

  deliveryRadiusKm: 10,
  serviceType: "delivery_takeaway_only" as const, // no dine-in

  contact: {
    phone: "+31684011572",
    whatsapp: "+31684011572",
    whatsappNumberE164: "31684011572", // no "+", used in wa.me links
    email: "info@kebabish.nl",
    secondaryEmail: "farhanahmadqilash@gmail.com",
  },

  website: "https://www.kebabish.nl",

  socials: {
    instagram: "https://instagram.com/kebabishnl",
    facebook: "https://facebook.com/kebabishnl",
    tiktok: "https://tiktok.com/@kebabishnl",
    threads: "https://threads.net/@kebabishnl",
    handle: "@kebabishnl",
  },

  // Draft list for local-SEO delivery-area pages. Confirm against the real
  // 10km driving radius before publishing.
  deliveryAreaTowns: [
    "Hoogkarspel",
    "Bovenkarspel",
    "Grootebroek",
    "Lutjebroek",
    "Westwoud",
    "Zwaagdijk-Oost",
    "Zwaagdijk-West",
    "Wognum",
    "Nibbixwoud",
    "Midwoud",
    "Oosterblokker",
    "Wervershoof",
    "Enkhuizen",
    "Hoorn",
  ],
} as const;

export function whatsappOrderLink(message: string) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${siteConfig.contact.whatsappNumberE164}?text=${encoded}`;
}
