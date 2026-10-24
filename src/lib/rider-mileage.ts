/**
 * Rider mileage: the arithmetic, as pure functions. Safe to import from the browser.
 *
 * **The odometer is the record.** The rider reads the number off the dashboard at the start of
 * the round and again at the end; the kilometres driven are the difference, and nothing else.
 * That figure covers the whole round — wrong turns, a second trip for a forgotten drink, the
 * ride back — which no amount of cleverness with delivery addresses can reconstruct.
 *
 * The site's own estimate from the delivery addresses is a **cross-check, not a measurement**,
 * and this module is careful about what it claims for it. It can only ever be a *straight-line*
 * figure, so:
 *
 * - `low` = out to the furthest delivery and back. Whatever order the rider drove in, they had
 *   to get there, so the round cannot have been shorter than this.
 * - `high` = every delivery as its own trip from the kitchen and back. If they went out once per
 *   order, this is it.
 *
 * Real roads are longer than straight lines, so a sound odometer figure sits **at or above
 * `low`**, usually comfortably. Anything *below* `low` is physically impossible as the crow
 * flies and is worth a question — a mistyped reading, the wrong vehicle, deliveries someone
 * else actually drove. That is the whole value of the cross-check; it is not a target, a norm,
 * or a basis for paying anybody, and no rate per kilometre is calculated anywhere.
 */

export interface MileageEstimate {
  /** Out to the furthest delivery and back, straight line. The round cannot be shorter. */
  lowKm: number;
  /** Every delivery as its own round trip, straight line. */
  highKm: number;
  /** How many deliveries this is built from. */
  stops: number;
  /** How many deliveries had to be left out because their address couldn't be located. */
  unlocated: number;
}

/** What the odometer says was driven, or null until both readings are in. */
export function shiftKm(startKm: number | null, endKm: number | null): number | null {
  if (startKm === null || endKm === null) return null;
  if (!Number.isFinite(startKm) || !Number.isFinite(endKm)) return null;
  if (endKm < startKm) return null;
  return endKm - startKm;
}

/**
 * The straight-line bounds for a round that reached these distances from the kitchen.
 * `unlocated` is carried through so the screen can say the estimate is incomplete rather
 * than quietly understating the round.
 */
export function estimateStraightLine(
  distancesKm: number[],
  unlocated = 0
): MileageEstimate | null {
  const usable = distancesKm.filter((d) => Number.isFinite(d) && d >= 0);
  if (usable.length === 0) return null;
  const furthest = Math.max(...usable);
  const sum = usable.reduce((total, d) => total + d, 0);
  return {
    lowKm: round1(furthest * 2),
    highKm: round1(sum * 2),
    stops: usable.length,
    unlocated,
  };
}

export type MileageVerdict = "noReading" | "noEstimate" | "belowStraightLine" | "plausible";

/**
 * How the odometer figure sits against the estimate. Only two answers matter: "impossible as
 * the crow flies, go and ask" and "nothing to see". There is deliberately no "too high" —
 * a long way round, a detour or a traffic diversion are all ordinary, and flagging them would
 * turn a sanity check into a performance measure.
 */
export function compareToEstimate(
  drivenKm: number | null,
  estimate: MileageEstimate | null
): MileageVerdict {
  if (drivenKm === null) return "noReading";
  if (!estimate) return "noEstimate";
  return drivenKm + 0.05 < estimate.lowKm ? "belowStraightLine" : "plausible";
}

/** A whole-number odometer reading from a form field, or null when it isn't one. */
export function parseOdometer(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  const whole = Math.round(n);
  return whole >= 0 && whole <= 1_000_000 ? whole : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "12,4 km" — one decimal, Dutch or English as the screen needs. */
export function formatKm(km: number, locale = "en-GB"): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)} km`;
}
