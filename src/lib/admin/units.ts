/**
 * Unit handling for the recipe system. Metric only — this is a Dutch
 * kitchen, and mixing unit systems in a costing tool invites mistakes.
 */

export type Unit = "g" | "kg" | "ml" | "l" | "pcs";
export type Dimension = "mass" | "volume" | "count";

export const DIMENSION_OF: Record<Unit, Dimension> = {
  g: "mass",
  kg: "mass",
  ml: "volume",
  l: "volume",
  pcs: "count",
};

/** How many base units (g / ml / pcs) one of each unit represents. */
const TO_BASE: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};

export const BASE_UNIT: Record<Dimension, Unit> = {
  mass: "g",
  volume: "ml",
  count: "pcs",
};

/** Convert a quantity to its dimension's base unit (grams, millilitres, pieces). */
export function toBase(quantity: number, unit: Unit): number {
  return quantity * TO_BASE[unit];
}

/** Convert a base-unit quantity back into a specific unit. */
export function fromBase(baseQuantity: number, unit: Unit): number {
  return baseQuantity / TO_BASE[unit];
}

/**
 * Render a base-unit quantity the way a cook would write it — grams until
 * it gets unwieldy, then kilos. Keeps shopping lists readable.
 */
export function formatQuantity(baseQuantity: number, dimension: Dimension): string {
  if (dimension === "count") {
    const rounded = Math.round(baseQuantity * 100) / 100;
    return `${trim(rounded)} pcs`;
  }

  const [big, small] = dimension === "mass" ? (["kg", "g"] as const) : (["l", "ml"] as const);

  if (baseQuantity >= 1000) {
    return `${trim(Math.round((baseQuantity / 1000) * 1000) / 1000)} ${big}`;
  }

  // Spices land in fractions of a gram; don't round them away to "0".
  const decimals = baseQuantity < 10 ? 1 : 0;
  return `${trim(Number(baseQuantity.toFixed(decimals)))} ${small}`;
}

/** Drop trailing zeros: 1.500 -> "1.5", 2.0 -> "2". */
function trim(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function formatMoney(amount: number): string {
  // Thousand separators matter here — "€ 49249.08" is genuinely hard to read
  // at a glance on a dashboard.
  return `€ ${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact form for chart axes and headline figures: € 49.2k */
export function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return `€ ${(amount / 1000).toFixed(1)}k`;
  }
  return `€ ${Math.round(amount)}`;
}
