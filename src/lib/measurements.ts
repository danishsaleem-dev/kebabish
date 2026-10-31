import type { MeasurementForm, StoredMeasurement } from "@/lib/admin/store/types";

/**
 * The measurement chart's rules. Pure and isomorphic (no I/O).
 *
 * Grams per spoon are measured per ingredient — a spoon of salt and a spoon of kasuri methi
 * differ by a factor of thirty — so there is deliberately no general conversion here, only
 * "this ingredient, this many spoons". An ingredient with no measurement can't be converted,
 * and `gramsFor` says so (null) instead of guessing.
 */

export const MEASUREMENT_FORM_LABELS: Record<MeasurementForm, string> = {
  whole: "Whole",
  bulk: "Bulk",
  liquid: "Liquid",
  sticks: "Sticks",
};

export type Spoon = "tbsp" | "tsp";

/** A tablespoon is three teaspoons, so a sound pair of readings sits close to 3. */
const RATIO_MIN = 2.5;
const RATIO_MAX = 3.5;

/** tbsp ÷ tsp, or null unless both are known. */
export function spoonRatio(m: Pick<StoredMeasurement, "gramsPerTbsp" | "gramsPerTsp">): number | null {
  if (!m.gramsPerTbsp || !m.gramsPerTsp || m.gramsPerTsp <= 0) return null;
  return Math.round((m.gramsPerTbsp / m.gramsPerTsp) * 100) / 100;
}

/**
 * Whether the two readings agree with each other. Far from 3 usually means one spoon was level
 * and the other heaped (or one was mistyped), so the screen asks for a second look. It is a
 * prompt, never a block: an odd ingredient can be genuinely odd.
 */
export function ratioLooksOff(m: Pick<StoredMeasurement, "gramsPerTbsp" | "gramsPerTsp">): boolean {
  const r = spoonRatio(m);
  return r !== null && (r < RATIO_MIN || r > RATIO_MAX);
}

/** Grams in `count` spoons of this ingredient, or null when that spoon wasn't measured. */
export function gramsFor(
  m: Pick<StoredMeasurement, "gramsPerTbsp" | "gramsPerTsp">,
  spoon: Spoon,
  count: number
): number | null {
  const per = spoon === "tbsp" ? m.gramsPerTbsp : m.gramsPerTsp;
  if (!per || !Number.isFinite(count) || count < 0) return null;
  return Math.round(per * count * 100) / 100;
}

/** A measurement's display name: the linked ingredient's own, else the chart's. */
export function measurementName(
  m: Pick<StoredMeasurement, "nameEn" | "ingredientId">,
  ingredientNames: Map<string, string>
): string {
  return (m.ingredientId && ingredientNames.get(m.ingredientId)) || m.nameEn;
}
