import { menu, type MenuCategoryId } from "@/lib/menu-data";

/**
 * Admin-side labels for the menu categories.
 *
 * The customer-facing names live in messages/nl.json + en.json and stay the
 * single source of truth for the public site. These English labels are for
 * the (English-only) admin panel. Once categories move to Supabase this
 * becomes a table and the ordering/visibility flags become real columns.
 */
export interface CategoryMeta {
  id: MenuCategoryId;
  label: string;
  description: string;
  /** Display order on the public menu. */
  position: number;
  visible: boolean;
}

export const categories: CategoryMeta[] = [
  {
    id: "mainDishes",
    label: "Main Dishes",
    description: "Rice plates and curries — the core of the menu.",
    position: 1,
    visible: true,
  },
  {
    id: "kebabsStarters",
    label: "Kebabs & Starters",
    description: "Grilled and fried starters, sold individually or as sides.",
    position: 2,
    visible: true,
  },
  {
    id: "breads",
    label: "Breads",
    description: "Tandoor breads, baked to order.",
    position: 3,
    visible: true,
  },
  {
    id: "fastFoodWraps",
    label: "Fast Food & Wraps",
    description: "Burgers, shoarma and wraps.",
    position: 4,
    visible: true,
  },
  {
    id: "specialtiesSides",
    label: "Specialties & Sides",
    description: "Chaat-style specialities and accompaniments.",
    position: 5,
    visible: true,
  },
  {
    id: "dessertsDrinks",
    label: "Desserts & Drinks",
    description: "Sweets and cold drinks.",
    position: 6,
    visible: true,
  },
];

export function categoryLabel(id: MenuCategoryId): string {
  return categories.find((c) => c.id === id)?.label ?? id;
}

export function itemCount(id: MenuCategoryId): number {
  return menu.find((c) => c.id === id)?.items.length ?? 0;
}
