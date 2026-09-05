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

  // The kitchen itself, supplied by Danish (not geocoded, not guessed).
  // Everything geographic keys off this: the delivery-area map's centre,
  // the radius circle, and the distance check on checkout.
  coordinates: {
    lat: 52.69807148044783,
    lng: 5.175562742328721,
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

  /**
   * The delivery area, ordered by distance from the kitchen.
   *
   * Coordinates are real town centres (geocoded from OpenStreetMap), not
   * hand-placed — the homepage map projects these onto a real map, so an
   * invented coordinate would visibly land in the wrong field.
   *
   * `km` is straight-line distance from the kitchen; driving distance is
   * always further. Note Wognum sits at 10.3km, just outside the stated
   * 10km radius — kept because it's already advertised, but worth a
   * decision from Danish.
   */
  deliveryAreaTowns: [
    { name: "Hoogkarspel", lat: 52.69047, lng: 5.18251, km: 0.97 },
    { name: "Lutjebroek", lat: 52.69839, lng: 5.20756, km: 2.16 },
    { name: "Zwaagdijk-Oost", lat: 52.70473, lng: 5.13362, km: 2.92 },
    { name: "Westwoud", lat: 52.68583, lng: 5.1317, km: 3.25 },
    { name: "Grootebroek", lat: 52.69744, lng: 5.22602, km: 3.4 },
    { name: "Wervershoof", lat: 52.72677, lng: 5.15054, km: 3.61 },
    { name: "Bovenkarspel", lat: 52.69883, lng: 5.24979, km: 5.0 },
    { name: "Oosterblokker", lat: 52.6642, lng: 5.12636, km: 5.02 },
    { name: "Midwoud", lat: 52.71842, lng: 5.07589, km: 7.09 },
    { name: "Enkhuizen", lat: 52.70363, lng: 5.29012, km: 7.74 },
    { name: "Nibbixwoud", lat: 52.69038, lng: 5.05995, km: 7.84 },
    { name: "Zwaagdijk-West", lat: 52.67559, lng: 5.05641, km: 8.41 },
    { name: "Hoorn", lat: 52.65327, lng: 5.07358, km: 8.49 },
    { name: "Wognum", lat: 52.6811, lng: 5.02474, km: 10.34 },
  ],
} as const;

/** Just the names — for prose, metadata and the SEO copy. */
export const deliveryTownNames = siteConfig.deliveryAreaTowns.map(
  (t) => t.name
);

export function whatsappOrderLink(message: string) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${siteConfig.contact.whatsappNumberE164}?text=${encoded}`;
}
