import { menu } from "@/lib/menu-data";
import { siteConfig } from "@/lib/site-config";
import { categories } from "@/lib/admin/categories";
import { EU_ALLERGENS, ingredients } from "@/lib/admin/ingredients";
import { recipes } from "@/lib/admin/recipes";
import type { StoreShape } from "@/lib/admin/store/types";

/**
 * First-run contents of the store, converted from the static files the panel
 * was prototyped against. After the first write the store is the source of
 * truth and these files are only a fallback.
 */
export function buildSeed(): StoreShape {
  return {
    allergens: EU_ALLERGENS.map((a) => ({ ...a, statutory: true })),

    media: [],

    settings: {
      // 0 = Sunday. Placeholder hours — Danish hasn't supplied the real ones.
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        closed: day === 1,
        opens: "16:00",
        closes: "22:00",
      })),
      deliveryRadiusKm: siteConfig.deliveryRadiusKm,
      deliveryFee: 2.5,
      freeDeliveryOver: 25,
      minimumOrder: 15,
      averagePrepMinutes: 35,
      acceptingOrders: true,
      orderNotice: "",
    },

    categories: categories.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      position: c.position,
      visible: c.visible,
    })),

    items: menu.flatMap((category) =>
      category.items.map((item) => ({
        slug: item.slug,
        name: item.name,
        categoryId: category.id,
        price: item.price,
        variants: item.variants ? [...item.variants] : [],
        vegetarian: Boolean(item.vegetarian),
        spicy: Boolean(item.spicy),
        soldOut: Boolean(item.soldOut),
        imageIds: [],
        optionGroupIds: [],
        tags: [],
        allergenIds: [],
        visible: true,
      }))
    ),

    // Extras are Danish's to define in /admin/menu/extras — seeding
    // invented sauces and prices would be worse than starting empty.
    optionGroups: [],

    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      group: i.group,
      unit: i.unit,
      costPerUnit: i.costPerUnit,
      allergens: [...i.allergens],
      supplier: i.supplier,
    })),

    recipes: recipes.map((r) => ({
      menuItemSlug: r.menuItemSlug,
      portionWeightG: r.portionWeightG,
      batchPortions: r.batchPortions,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      lines: r.lines.map((l) => ({ ...l })),
      steps: [...r.steps],
      notes: r.notes,
    })),
  };
}
