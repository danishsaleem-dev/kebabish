import type { Unit } from "@/lib/admin/units";

/**
 * PLACEHOLDER recipes.
 *
 * Quantities are cook's-estimate placeholders so the scaling and costing
 * maths has something realistic to work against — they are NOT Danish's
 * actual recipes. He supplies the real ones; the UI is built so entering
 * them is the only work required.
 */

export interface RecipeLine {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  /** Prep note shown next to the line, e.g. "finely sliced". */
  note?: string;
  /** Garnishes and similar — excluded from cost when toggled off. */
  optional?: boolean;
}

export interface Recipe {
  /** Links to a `slug` in src/lib/menu-data.ts */
  menuItemSlug: string;
  /** Plated weight of ONE portion, in grams — "one plate of biryani is 500 g". */
  portionWeightG: number;
  /** How many portions the quantities below produce as written. */
  batchPortions: number;
  prepMinutes: number;
  cookMinutes: number;
  lines: RecipeLine[];
  steps: string[];
  notes?: string;
}

export const recipes: Recipe[] = [
  {
    menuItemSlug: "chicken-biryani",
    portionWeightG: 500,
    batchPortions: 4,
    prepMinutes: 35,
    cookMinutes: 55,
    lines: [
      { ingredientId: "basmati-rice", quantity: 500, unit: "g", note: "soaked 30 min" },
      { ingredientId: "chicken-thigh", quantity: 800, unit: "g", note: "cut in 4 cm pieces" },
      { ingredientId: "onion", quantity: 300, unit: "g", note: "finely sliced, fried golden" },
      { ingredientId: "tomato", quantity: 200, unit: "g", note: "chopped" },
      { ingredientId: "yoghurt", quantity: 200, unit: "g" },
      { ingredientId: "garlic-ginger-paste", quantity: 40, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 120, unit: "ml" },
      { ingredientId: "ghee", quantity: 40, unit: "g" },
      { ingredientId: "biryani-masala", quantity: 35, unit: "g" },
      { ingredientId: "garam-masala", quantity: 8, unit: "g" },
      { ingredientId: "chilli-powder", quantity: 10, unit: "g" },
      { ingredientId: "turmeric", quantity: 5, unit: "g" },
      { ingredientId: "salt", quantity: 15, unit: "g" },
      { ingredientId: "saffron", quantity: 0.5, unit: "g", note: "bloomed in warm milk" },
      { ingredientId: "milk", quantity: 50, unit: "ml" },
      { ingredientId: "coriander-fresh", quantity: 25, unit: "g", optional: true },
      { ingredientId: "mint-fresh", quantity: 20, unit: "g", optional: true },
      { ingredientId: "green-chilli", quantity: 20, unit: "g", optional: true },
      { ingredientId: "box-large", quantity: 4, unit: "pcs" },
    ],
    steps: [
      "Fry the sliced onion until deep golden, reserve half for layering.",
      "Bhuna the chicken with ginger–garlic, tomato, yoghurt and ground spices.",
      "Parboil the soaked rice to 70% with whole spices and salt.",
      "Layer rice over the masala, top with saffron milk, ghee and fried onion.",
      "Seal and steam on dum for 20 minutes, rest 10 minutes before serving.",
    ],
    notes: "Rice absorbs water while the masala reduces — check the yield figure after any change.",
  },
  {
    menuItemSlug: "chicken-shami-kebab",
    portionWeightG: 60,
    batchPortions: 10,
    prepMinutes: 40,
    cookMinutes: 20,
    lines: [
      { ingredientId: "chicken-mince", quantity: 500, unit: "g" },
      { ingredientId: "chana-dal", quantity: 150, unit: "g", note: "soaked overnight" },
      { ingredientId: "onion", quantity: 100, unit: "g" },
      { ingredientId: "garlic-ginger-paste", quantity: 25, unit: "g" },
      { ingredientId: "egg", quantity: 1, unit: "pcs", note: "for binding" },
      { ingredientId: "garam-masala", quantity: 6, unit: "g" },
      { ingredientId: "chilli-powder", quantity: 6, unit: "g" },
      { ingredientId: "cumin", quantity: 5, unit: "g" },
      { ingredientId: "salt", quantity: 10, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 80, unit: "ml", note: "for shallow frying" },
      { ingredientId: "coriander-fresh", quantity: 15, unit: "g", optional: true },
    ],
    steps: [
      "Boil the mince with dal, aromatics and spices until completely dry.",
      "Cool, then grind to a smooth paste.",
      "Bind with egg, shape into 60 g patties.",
      "Shallow fry until crisp on both sides.",
    ],
  },
  {
    menuItemSlug: "garlic-naan",
    portionWeightG: 120,
    batchPortions: 6,
    prepMinutes: 90,
    cookMinutes: 12,
    lines: [
      { ingredientId: "flour", quantity: 500, unit: "g" },
      { ingredientId: "yoghurt", quantity: 100, unit: "g" },
      { ingredientId: "milk", quantity: 140, unit: "ml", note: "lukewarm" },
      { ingredientId: "yeast", quantity: 7, unit: "g" },
      { ingredientId: "sugar", quantity: 10, unit: "g" },
      { ingredientId: "salt", quantity: 9, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 30, unit: "ml" },
      { ingredientId: "butter", quantity: 50, unit: "g", note: "brushed after baking" },
      { ingredientId: "garlic-ginger-paste", quantity: 30, unit: "g" },
      { ingredientId: "coriander-fresh", quantity: 10, unit: "g", optional: true },
    ],
    steps: [
      "Activate yeast in warm milk with sugar.",
      "Knead with flour, yoghurt, oil and salt into a soft dough. Prove 1 hour.",
      "Divide into 6, roll, top with garlic.",
      "Bake in a very hot tandoor/oven, brush with butter.",
    ],
  },
  {
    menuItemSlug: "chicken-shoarma",
    portionWeightG: 350,
    batchPortions: 4,
    prepMinutes: 25,
    cookMinutes: 20,
    lines: [
      { ingredientId: "chicken-thigh", quantity: 600, unit: "g", note: "marinated 4 h" },
      { ingredientId: "tortilla-wrap", quantity: 4, unit: "pcs" },
      { ingredientId: "lettuce", quantity: 160, unit: "g" },
      { ingredientId: "tomato", quantity: 160, unit: "g" },
      { ingredientId: "onion", quantity: 80, unit: "g" },
      { ingredientId: "garlic-sauce", quantity: 120, unit: "g" },
      { ingredientId: "yoghurt", quantity: 80, unit: "g", note: "in the marinade" },
      { ingredientId: "chaat-masala", quantity: 8, unit: "g" },
      { ingredientId: "chilli-powder", quantity: 5, unit: "g" },
      { ingredientId: "salt", quantity: 8, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 40, unit: "ml" },
      { ingredientId: "box-small", quantity: 4, unit: "pcs" },
    ],
    steps: [
      "Marinate the thigh in yoghurt, spices and oil.",
      "Grill hot and slice thin.",
      "Warm the wraps, build with salad and garlic sauce, roll and toast.",
    ],
  },
  {
    menuItemSlug: "zinger-burger",
    portionWeightG: 280,
    batchPortions: 4,
    prepMinutes: 30,
    cookMinutes: 15,
    lines: [
      { ingredientId: "chicken-breast", quantity: 600, unit: "g", note: "flattened, 150 g each" },
      { ingredientId: "burger-bun", quantity: 4, unit: "pcs" },
      { ingredientId: "breadcrumbs", quantity: 150, unit: "g" },
      { ingredientId: "flour", quantity: 100, unit: "g" },
      { ingredientId: "egg", quantity: 2, unit: "pcs" },
      { ingredientId: "mayonnaise", quantity: 80, unit: "g" },
      { ingredientId: "lettuce", quantity: 80, unit: "g" },
      { ingredientId: "cheese-slice", quantity: 60, unit: "g", optional: true },
      { ingredientId: "chilli-powder", quantity: 6, unit: "g" },
      { ingredientId: "salt", quantity: 8, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 400, unit: "ml", note: "deep frying — reusable" },
      { ingredientId: "box-small", quantity: 4, unit: "pcs" },
    ],
    steps: [
      "Marinate the flattened breast in spiced buttermilk.",
      "Dredge flour → egg → breadcrumb.",
      "Deep fry at 170 °C for 6–7 minutes.",
      "Build the bun with mayo, lettuce and the fillet.",
    ],
    notes: "Frying oil is costed in full here — adjust once you know how many batches one oil change covers.",
  },
  {
    menuItemSlug: "veg-samosa",
    portionWeightG: 70,
    batchPortions: 12,
    prepMinutes: 45,
    cookMinutes: 15,
    lines: [
      { ingredientId: "samosa-pastry", quantity: 12, unit: "pcs" },
      { ingredientId: "potato", quantity: 600, unit: "g", note: "boiled and roughly crushed" },
      { ingredientId: "onion", quantity: 120, unit: "g" },
      { ingredientId: "green-chilli", quantity: 20, unit: "g" },
      { ingredientId: "cumin", quantity: 6, unit: "g" },
      { ingredientId: "coriander-powder", quantity: 6, unit: "g" },
      { ingredientId: "turmeric", quantity: 4, unit: "g" },
      { ingredientId: "chaat-masala", quantity: 6, unit: "g" },
      { ingredientId: "salt", quantity: 8, unit: "g" },
      { ingredientId: "coriander-fresh", quantity: 15, unit: "g" },
      { ingredientId: "sunflower-oil", quantity: 300, unit: "ml", note: "deep frying" },
    ],
    steps: [
      "Temper cumin, add onion and chilli, then the crushed potato and spices.",
      "Cool the filling completely before shaping.",
      "Fold, seal with flour paste, fry at 165 °C until golden.",
    ],
  },
];

const BY_SLUG = new Map(recipes.map((r) => [r.menuItemSlug, r]));

export function findRecipe(menuItemSlug: string): Recipe | undefined {
  return BY_SLUG.get(menuItemSlug);
}
