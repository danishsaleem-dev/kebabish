import type { Unit } from "@/lib/admin/units";

/**
 * PLACEHOLDER ingredient library.
 *
 * Names are plausible for a Pakistani kitchen but every cost is invented —
 * Danish has not supplied supplier pricing. Treat `costPerUnit` as a
 * demonstration of the costing maths, not as real figures. Replace wholesale
 * once real invoices/supplier prices exist (and move to Supabase).
 */

/**
 * Allergen ids are free-form strings, not a fixed union — Danish can add his
 * own beyond the statutory list (e.g. "coconut", "food colouring"). The 14
 * below are the ones EU regulation 1169/2011 *requires* a food business to
 * declare; they seed the store and are flagged so they can't be deleted.
 */
export type Allergen = string;

export const EU_ALLERGENS: { id: string; label: string }[] = [
  { id: "gluten", label: "Gluten" },
  { id: "crustaceans", label: "Crustaceans" },
  { id: "eggs", label: "Eggs" },
  { id: "fish", label: "Fish" },
  { id: "peanuts", label: "Peanuts" },
  { id: "soy", label: "Soy" },
  { id: "milk", label: "Milk" },
  { id: "nuts", label: "Nuts" },
  { id: "celery", label: "Celery" },
  { id: "mustard", label: "Mustard" },
  { id: "sesame", label: "Sesame" },
  { id: "sulphites", label: "Sulphites" },
  { id: "lupin", label: "Lupin" },
  { id: "molluscs", label: "Molluscs" },
];

/** Fallback labels for the statutory set; the store is the real source. */
export const ALLERGEN_LABELS: Record<string, string> = Object.fromEntries(
  EU_ALLERGENS.map((a) => [a.id, a.label])
);

export type IngredientGroup =
  | "meat"
  | "produce"
  | "dairy"
  | "dry-goods"
  | "spices"
  | "oils"
  | "packaging";

export const GROUP_LABELS: Record<IngredientGroup, string> = {
  meat: "Meat & poultry",
  produce: "Fresh produce",
  dairy: "Dairy",
  "dry-goods": "Dry goods",
  spices: "Spices & seasoning",
  oils: "Oils & fats",
  packaging: "Packaging",
};

export interface Ingredient {
  id: string;
  name: string;
  group: IngredientGroup;
  /** The unit purchasing/costing is expressed in. */
  unit: Unit;
  /** Cost of one `unit` in euros. PLACEHOLDER. */
  costPerUnit: number;
  allergens: Allergen[];
  supplier?: string;
}

export const ingredients: Ingredient[] = [
  // meat
  { id: "chicken-thigh", name: "Chicken thigh (boneless)", group: "meat", unit: "kg", costPerUnit: 6.8, allergens: [] },
  { id: "chicken-breast", name: "Chicken breast", group: "meat", unit: "kg", costPerUnit: 8.4, allergens: [] },
  { id: "chicken-mince", name: "Chicken mince", group: "meat", unit: "kg", costPerUnit: 7.2, allergens: [] },
  { id: "chicken-wings", name: "Chicken wings", group: "meat", unit: "kg", costPerUnit: 4.9, allergens: [] },

  // produce
  { id: "onion", name: "Onion", group: "produce", unit: "kg", costPerUnit: 1.1, allergens: [] },
  { id: "tomato", name: "Tomato", group: "produce", unit: "kg", costPerUnit: 2.4, allergens: [] },
  { id: "potato", name: "Potato", group: "produce", unit: "kg", costPerUnit: 1.0, allergens: [] },
  { id: "garlic-ginger-paste", name: "Ginger–garlic paste", group: "produce", unit: "kg", costPerUnit: 5.5, allergens: [] },
  { id: "green-chilli", name: "Green chilli", group: "produce", unit: "kg", costPerUnit: 6.0, allergens: [] },
  { id: "coriander-fresh", name: "Fresh coriander", group: "produce", unit: "kg", costPerUnit: 9.0, allergens: [] },
  { id: "mint-fresh", name: "Fresh mint", group: "produce", unit: "kg", costPerUnit: 11.0, allergens: [] },
  { id: "lettuce", name: "Lettuce", group: "produce", unit: "kg", costPerUnit: 3.2, allergens: [] },
  { id: "lemon", name: "Lemon", group: "produce", unit: "pcs", costPerUnit: 0.35, allergens: [] },

  // dairy
  { id: "yoghurt", name: "Yoghurt (full fat)", group: "dairy", unit: "kg", costPerUnit: 2.3, allergens: ["milk"] },
  { id: "milk", name: "Milk", group: "dairy", unit: "l", costPerUnit: 1.15, allergens: ["milk"] },
  { id: "butter", name: "Butter", group: "dairy", unit: "kg", costPerUnit: 9.5, allergens: ["milk"] },
  { id: "ghee", name: "Ghee", group: "dairy", unit: "kg", costPerUnit: 11.0, allergens: ["milk"] },
  { id: "cheese-slice", name: "Cheese slices", group: "dairy", unit: "kg", costPerUnit: 8.9, allergens: ["milk"] },
  { id: "cream", name: "Cream", group: "dairy", unit: "l", costPerUnit: 3.4, allergens: ["milk"] },

  // dry goods
  { id: "basmati-rice", name: "Basmati rice", group: "dry-goods", unit: "kg", costPerUnit: 2.2, allergens: [] },
  { id: "flour", name: "Wheat flour", group: "dry-goods", unit: "kg", costPerUnit: 1.05, allergens: ["gluten"] },
  { id: "chana-dal", name: "Chana dal", group: "dry-goods", unit: "kg", costPerUnit: 2.6, allergens: [] },
  { id: "breadcrumbs", name: "Breadcrumbs", group: "dry-goods", unit: "kg", costPerUnit: 2.1, allergens: ["gluten"] },
  { id: "burger-bun", name: "Burger bun", group: "dry-goods", unit: "pcs", costPerUnit: 0.32, allergens: ["gluten", "sesame"] },
  { id: "tortilla-wrap", name: "Tortilla wrap", group: "dry-goods", unit: "pcs", costPerUnit: 0.28, allergens: ["gluten"] },
  { id: "samosa-pastry", name: "Samosa pastry sheet", group: "dry-goods", unit: "pcs", costPerUnit: 0.09, allergens: ["gluten"] },
  { id: "egg", name: "Egg", group: "dry-goods", unit: "pcs", costPerUnit: 0.28, allergens: ["eggs"] },
  { id: "yeast", name: "Dried yeast", group: "dry-goods", unit: "kg", costPerUnit: 12.0, allergens: [] },
  { id: "sugar", name: "Sugar", group: "dry-goods", unit: "kg", costPerUnit: 1.2, allergens: [] },

  // spices
  { id: "biryani-masala", name: "Biryani masala", group: "spices", unit: "kg", costPerUnit: 14.0, allergens: ["mustard"] },
  { id: "garam-masala", name: "Garam masala", group: "spices", unit: "kg", costPerUnit: 16.0, allergens: [] },
  { id: "chilli-powder", name: "Red chilli powder", group: "spices", unit: "kg", costPerUnit: 9.5, allergens: [] },
  { id: "turmeric", name: "Turmeric", group: "spices", unit: "kg", costPerUnit: 8.0, allergens: [] },
  { id: "cumin", name: "Cumin seeds", group: "spices", unit: "kg", costPerUnit: 10.5, allergens: [] },
  { id: "coriander-powder", name: "Coriander powder", group: "spices", unit: "kg", costPerUnit: 7.5, allergens: [] },
  { id: "saffron", name: "Saffron", group: "spices", unit: "kg", costPerUnit: 4200, allergens: [] },
  { id: "salt", name: "Salt", group: "spices", unit: "kg", costPerUnit: 0.6, allergens: [] },
  { id: "chaat-masala", name: "Chaat masala", group: "spices", unit: "kg", costPerUnit: 12.5, allergens: [] },

  // oils
  { id: "sunflower-oil", name: "Sunflower oil", group: "oils", unit: "l", costPerUnit: 2.05, allergens: [] },
  { id: "mayonnaise", name: "Mayonnaise", group: "oils", unit: "kg", costPerUnit: 3.6, allergens: ["eggs", "mustard"] },
  { id: "garlic-sauce", name: "Garlic sauce", group: "oils", unit: "kg", costPerUnit: 4.2, allergens: ["eggs", "milk"] },

  // packaging
  { id: "box-large", name: "Meal box (large)", group: "packaging", unit: "pcs", costPerUnit: 0.24, allergens: [] },
  { id: "box-small", name: "Meal box (small)", group: "packaging", unit: "pcs", costPerUnit: 0.16, allergens: [] },
  { id: "carrier-bag", name: "Carrier bag", group: "packaging", unit: "pcs", costPerUnit: 0.11, allergens: [] },
];

const BY_ID = new Map(ingredients.map((i) => [i.id, i]));

export function findIngredient(id: string): Ingredient | undefined {
  return BY_ID.get(id);
}
