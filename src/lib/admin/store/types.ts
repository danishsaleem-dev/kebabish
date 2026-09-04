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
  /** Media ids, in display order. The first is the featured image. */
  imageIds: string[];
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

export interface StoreShape {
  categories: StoredCategory[];
  items: StoredItem[];
  ingredients: StoredIngredient[];
  recipes: StoredRecipe[];
  allergens: StoredAllergen[];
  media: StoredMedia[];
  settings: StoredSettings;
}

/** Every backend adapter satisfies this. */
export interface StoreAdapter {
  read(): Promise<StoreShape>;
  write(data: StoreShape): Promise<void>;
}
