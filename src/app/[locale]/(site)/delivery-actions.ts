"use server";

import { assessDelivery, cleanPostcode } from "@/lib/delivery-area";

export type DeliveryCheckResult =
  | {
      ok: true;
      deliverable: boolean;
      km: number | null;
      radiusKm: number;
      street: string;
      city: string;
      postcode: string;
    }
  | { ok: false; error: "invalidPostcode" | "busy" | "failed" };

// A blunt per-instance cap: this endpoint is a public door to the address register, and a
// script has no business hammering it through us. A customer typing an address makes a
// handful of calls a minute.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90;
let windowStart = 0;
let used = 0;

/**
 * "Do we deliver to this address?" for the postcode box on the site: the location dialog,
 * checkout and the contact page. Public and read-only; it answers from the address register
 * and the kitchen's coordinates, never from anything the browser claims. The order itself
 * is checked again by `checkoutAction`.
 */
export async function checkDeliveryAction(input: {
  postcode: string;
  houseNumber?: string;
}): Promise<DeliveryCheckResult> {
  const postcode = typeof input?.postcode === "string" ? input.postcode.slice(0, 12) : "";
  const houseNumber = typeof input?.houseNumber === "string" ? input.houseNumber.slice(0, 12) : "";
  if (!cleanPostcode(postcode)) return { ok: false, error: "invalidPostcode" };

  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    used = 0;
  }
  if (++used > MAX_PER_WINDOW) return { ok: false, error: "busy" };

  const a = await assessDelivery({ postcode, houseNumber });
  if (!a.found) {
    return { ok: false, error: a.lookup === "unavailable" ? "failed" : "invalidPostcode" };
  }
  return {
    ok: true,
    deliverable: a.deliverable,
    km: a.km,
    radiusKm: a.radiusKm,
    street: a.street,
    city: a.city,
    postcode: a.postcode,
  };
}
