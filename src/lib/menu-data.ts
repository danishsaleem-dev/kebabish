/**
 * Menu source data.
 *
 * NOTE: prices, descriptions, and photos were not part of the finalized
 * menu list yet, so `price` is `null` and `image` is empty for every item.
 * The site renders "priceOnRequest" wherever price is null. Fill these in
 * (directly here, or later via the admin dashboard once it's wired to
 * Supabase) before launch.
 */

export type MenuCategoryId =
  | "mainDishes"
  | "kebabsStarters"
  | "breads"
  | "fastFoodWraps"
  | "specialtiesSides"
  | "dessertsDrinks";

export interface MenuItem {
  slug: string;
  name: string;
  price: number | null;
  /** e.g. flavor/size variants like a milkshake's flavors */
  variants?: string[];
  image?: string;
  spicy?: boolean;
  vegetarian?: boolean;
  soldOut?: boolean;
}

export interface MenuCategory {
  id: MenuCategoryId;
  items: MenuItem[];
}

export const menu: MenuCategory[] = [
  {
    id: "mainDishes",
    items: [
      { slug: "chicken-biryani", name: "Chicken Biryani", price: null },
      { slug: "vegetable-chinese-rice", name: "Vegetable Chinese Rice", price: null, vegetarian: true },
      { slug: "kebab-masala-curry", name: "Kebab Masala / Curry", price: null },
    ],
  },
  {
    id: "kebabsStarters",
    items: [
      { slug: "chicken-shami-kebab", name: "Chicken Shami Kebab", price: null },
      { slug: "chicken-chapli-kebab", name: "Chicken Chapli Kebab", price: null },
      { slug: "chicken-reshmi-kebab", name: "Chicken Reshmi Kebab", price: null },
      { slug: "homemade-patties", name: "Homemade Patties", price: null },
      { slug: "veg-samosa", name: "Veg Samosa", price: null, vegetarian: true },
      { slug: "chicken-samosa", name: "Chicken Samosa", price: null },
      { slug: "homemade-nuggets", name: "Homemade Nuggets", price: null },
      { slug: "fried-wings", name: "Fried Wings", price: null },
      { slug: "homemade-special-fries", name: "Homemade Special Fries", price: null, vegetarian: true },
    ],
  },
  {
    id: "breads",
    items: [
      { slug: "qeema-naan", name: "Qeema Naan", price: null },
      { slug: "garlic-naan", name: "Garlic Naan", price: null, vegetarian: true },
      { slug: "sada-naan", name: "Sada Naan", price: null, vegetarian: true },
    ],
  },
  {
    id: "fastFoodWraps",
    items: [
      { slug: "chicken-shoarma", name: "Chicken Shoarma", price: null },
      { slug: "zinger-shoarma", name: "Zinger Shoarma", price: null },
      { slug: "zinger-burger", name: "Zinger Burger", price: null },
      { slug: "shami-burger", name: "Shami Burger", price: null },
    ],
  },
  {
    id: "specialtiesSides",
    items: [
      { slug: "dahi-bhalay", name: "Dahi Bhalay", price: null, vegetarian: true },
    ],
  },
  {
    id: "dessertsDrinks",
    items: [
      { slug: "pudding", name: "Pudding", price: null, vegetarian: true },
      {
        slug: "milk-shake",
        name: "Milk Shake",
        price: null,
        vegetarian: true,
        variants: ["Mango", "Banana", "Strawberry"],
      },
    ],
  },
];

export function findMenuItem(slug: string): MenuItem | undefined {
  for (const category of menu) {
    const item = category.items.find((i) => i.slug === slug);
    if (item) return item;
  }
  return undefined;
}
