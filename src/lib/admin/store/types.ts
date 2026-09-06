import type { Allergen, IngredientGroup } from "@/lib/admin/ingredients";
import type { Unit } from "@/lib/admin/units";

/**
 * The admin panel's mutable domain model.
 *
 * These types are deliberately backend-agnostic — they describe what the app
 * needs, not how it's stored. The JSON-file store implements them today and a
 * Supabase adapter will implement the same shapes later, so nothing above the
 * store layer has to change when the backend swaps.
 */

export interface StoredMedia {
  id: string;
  /** Public URL, e.g. /uploads/chicken-biryani-a1b2.jpg */
  url: string;
  filename: string;
  /** Alt text — required for accessibility and worth real SEO on a food site. */
  alt: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  uploadedAt: string;
}

export interface StoredCategory {
  id: string;
  label: string;
  description: string;
  /** Display order on the public menu; 1-based. */
  position: number;
  visible: boolean;
  /** Media id for the category's featured image. */
  imageId?: string;
}

export interface StoredItem {
  slug: string;
  name: string;
  categoryId: string;
  price: number | null;
  variants: string[];
  vegetarian: boolean;
  spicy: boolean;
  soldOut: boolean;
  /**
   * Shown on the public menu at all. Separate from `soldOut` — a sold-out
   * dish still shows (marked unavailable); an invisible one is a draft
   * that doesn't appear yet, e.g. while you're still setting it up.
   */
  visible: boolean;
  /** Media ids, in display order. The first is the featured image. */
  imageIds: string[];
  /** Extras offered with this dish, by option-group id. */
  optionGroupIds: string[];
  /** Free-form labels, admin-side only for now — not yet a public filter. */
  tags: string[];
  /**
   * Manually flagged allergens, by allergen id. Separate from a recipe's
   * own auto-rolled-up allergens (from its ingredients) — a dish can be
   * flagged here before its recipe exists, or for an allergen that isn't
   * traceable to one ingredient line.
   */
  allergenIds: string[];
}

/** One choice inside an option group, e.g. "Garlic sauce" at +€0.75. */
export interface StoredOption {
  id: string;
  label: string;
  /** Surcharge in euros. 0 is free. */
  price: number;
}

/**
 * A reusable set of extras ("Sauces", "Drinks", "Extra toppings") that can
 * be attached to any number of dishes. Reusable rather than per-dish so
 * changing the price of a sauce is one edit, not twenty.
 */
export interface StoredOptionGroup {
  id: string;
  label: string;
  /** 0 makes the group optional; 1+ forces a choice. */
  minChoices: number;
  /** 1 renders as radios, more as checkboxes capped at this many. */
  maxChoices: number;
  options: StoredOption[];
}

export interface StoredSettings {
  /** Opening hours per weekday, 0 = Sunday. Closed when `closed` is true. */
  hours: {
    day: number;
    closed: boolean;
    opens: string;
    closes: string;
  }[];
  deliveryRadiusKm: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minimumOrder: number;
  averagePrepMinutes: number;
  acceptingOrders: boolean;
  orderNotice: string;
}

export interface StoredIngredient {
  id: string;
  name: string;
  group: IngredientGroup;
  unit: Unit;
  costPerUnit: number;
  allergens: Allergen[];
  supplier?: string;
}

export interface StoredRecipeLine {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export interface StoredRecipe {
  menuItemSlug: string;
  portionWeightG: number;
  batchPortions: number;
  prepMinutes: number;
  cookMinutes: number;
  lines: StoredRecipeLine[];
  steps: string[];
  notes?: string;
}

export interface StoredAllergen {
  id: string;
  label: string;
  /** True for the 14 EU-mandated allergens — these can be renamed but not deleted. */
  statutory: boolean;
}

export interface StoredPromoCode {
  id: string;
  /** Stored uppercase; matching is case-insensitive at lookup time. */
  code: string;
  type: "percentage" | "fixed";
  /** A percentage (1-100) when `type` is "percentage", euros when "fixed". */
  value: number;
  active: boolean;
  /** Euros; null means no minimum order. */
  minOrder: number | null;
  /** ISO date (yyyy-mm-dd); null means it never expires. */
  expiresAt: string | null;
  /** Once true, a customer email can redeem this code on at most one paid order. */
  singleUsePerCustomer: boolean;
  createdAt: string;
}

export interface StoreShape {
  categories: StoredCategory[];
  items: StoredItem[];
  optionGroups: StoredOptionGroup[];
  ingredients: StoredIngredient[];
  recipes: StoredRecipe[];
  allergens: StoredAllergen[];
  promoCodes: StoredPromoCode[];
  media: StoredMedia[];
  settings: StoredSettings;
}

/** Every backend adapter satisfies this. */
export interface StoreAdapter {
  read(): Promise<StoreShape>;
  write(data: StoreShape): Promise<void>;
}
