import "server-only";
import { readStore } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { distanceKm, parsePoint } from "@/lib/geo";
import { isDeliverableTown } from "@/lib/orders";

/**
 * "Do we deliver there?" — decided by how far the address is from the kitchen, not by
 * whether its town happens to be on a list.
 *
 * The list used to be the whole rule, which turned away a customer 6 km from the
 * kitchen simply because his village wasn't one of the 14 names we had written down.
 * Now the address is looked up in the official Dutch address register (PDOK / BAG,
 * the same service the checkout's postcode box uses), its coordinates are measured
 * against the kitchen's, and it is deliverable when it falls inside the delivery radius
 * (Settings → delivery radius). The town list is kept as a second way *in*, never a
 * way out: a town we advertise (Wognum sits just past 10 km) is always accepted.
 *
 * Everything the browser tells us is only a hint. This runs on the server, from the
 * postcode and house number alone, both when the customer is told "yes, we deliver to
 * you" and again when the order is placed.
 */

const SEARCH_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const LOOKUP_TIMEOUT_MS = 5000;

export interface DeliveryAssessment {
  deliverable: boolean;
  /** How the answer was reached: measured, matched on the town list, or neither. */
  basis: "distance" | "town" | "none";
  /** Straight-line km from the kitchen, null when the address couldn't be located. */
  km: number | null;
  radiusKm: number;
  /** False when the register had nothing for that postcode (or couldn't be reached). */
  found: boolean;
  /** "unavailable" = the register couldn't be reached, as opposed to having no such postcode. */
  lookup: "ok" | "notFound" | "unavailable";
  street: string;
  city: string;
  postcode: string;
}

/** "1616 rk" → "1616RK"; null when it isn't a Dutch postcode. */
export function cleanPostcode(value: string): string | null {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return /^[1-9]\d{3}[A-Z]{2}$/.test(compact) ? compact : null;
}

/** The digits of a house number ("49", "49a", "49-2" → 49), or null. */
export function houseNumberDigits(value: string): number | null {
  const m = /^\s*(\d{1,5})/.exec(value);
  return m ? Number(m[1]) : null;
}

interface PdokDoc {
  straatnaam?: string;
  woonplaatsnaam?: string;
  postcode?: string;
  centroide_ll?: string;
}

async function search(params: Record<string, string | string[]>): Promise<PdokDoc | null> {
  const url = new URL(SEARCH_URL);
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(key, v);
  }
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "straatnaam,woonplaatsnaam,postcode,centroide_ll");

  // One retry: the first request after a quiet spell sometimes loses to a cold connection,
  // and a customer shouldn't be told "no" because of that.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) throw new Error(`PDOK ${res.status}`);
      const data = (await res.json()) as { response?: { docs?: PdokDoc[] } };
      return data.response?.docs?.[0] ?? null;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Locate a postcode (and, when given, the exact house number) and measure it.
 * `city` is only used as a fallback if the register can't be reached.
 */
export async function assessDelivery(input: {
  postcode: string;
  houseNumber?: string;
  city?: string;
}): Promise<DeliveryAssessment> {
  const store = await readStore().catch(() => null);
  const radiusKm = Number(store?.settings.deliveryRadiusKm) || siteConfig.deliveryRadiusKm;
  const postcode = cleanPostcode(input.postcode);
  const fallbackCity = (input.city ?? "").trim();

  const unknown = (lookup: "notFound" | "unavailable"): DeliveryAssessment => {
    // Couldn't measure: fall back to the town we were told, so a hiccup in the address
    // register never stops a customer from a listed town ordering.
    const listed = fallbackCity !== "" && isDeliverableTown(fallbackCity);
    return {
      deliverable: listed,
      basis: listed ? "town" : "none",
      km: null,
      radiusKm,
      found: false,
      lookup,
      street: "",
      city: fallbackCity,
      postcode: postcode ?? input.postcode.trim(),
    };
  };

  if (!postcode) return unknown("notFound");

  let doc: PdokDoc | null = null;
  try {
    const number = houseNumberDigits(input.houseNumber ?? "");
    if (number !== null) {
      doc = await search({
        q: "*",
        fq: ["type:adres", `postcode:${postcode}`, `huisnummer:${number}`],
      });
    }
    // An unknown house number, or none given: the postcode alone is a single street.
    doc ??= await search({ q: "*", fq: ["type:postcode", `postcode:${postcode}`] });
  } catch (err) {
    console.error("[delivery-area] address lookup failed:", err);
    return unknown("unavailable");
  }

  const point = parsePoint(doc?.centroide_ll);
  if (!doc || !point) return unknown("notFound");

  const km = distanceKm(siteConfig.coordinates, point);
  const city = doc.woonplaatsnaam ?? fallbackCity;
  const within = km <= radiusKm;
  const listed = isDeliverableTown(city);

  return {
    deliverable: within || listed,
    basis: within ? "distance" : listed ? "town" : "none",
    km: Math.round(km * 10) / 10,
    radiusKm,
    found: true,
    lookup: "ok",
    street: doc.straatnaam ?? "",
    city,
    postcode: doc.postcode ?? postcode,
  };
}
