import { readStore } from "@/lib/admin/store";
import { buildSeed } from "@/lib/admin/store/seed";
import { dishImage } from "@/lib/dish-images";
import type { StoreShape, StoredOptionGroup } from "@/lib/admin/store/types";

/**
 * The public menu, read from the same store the admin panel writes.
 *
 * This is what makes Danish's edits — prices, sold-out flags, extras —
 * actually appear on kebabish.nl. Like getPublicSettings(), it degrades to
 * seeded content rather than taking the storefront down if the database is
 * unreachable.
 */

export interface PublicOption {
  id: string;
  label: string;
  price: number;
}

export interface PublicOptionGroup {
  id: string;
  label: string;
  minChoices: number;
  maxChoices: number;
  options: PublicOption[];
}

export interface PublicMenuItem {
  slug: string;
  name: string;
  price: number | null;
  variants: string[];
  vegetarian: boolean;
  spicy: boolean;
  soldOut: boolean;
  image?: string;
  /** Plain text; line breaks are meaningful. Empty when none was written. */
  description: string;
  /** Uploaded video URL, or "" for none. */
  videoUrl: string;
  /** Everything this dish contains — manual flags plus its recipe's. */
  allergens: { id: string; label: string }[];
  optionGroups: PublicOptionGroup[];
}

export interface PublicMenuCategory {
  id: string;
  label: string;
  description: string;
  items: PublicMenuItem[];
}

async function read(): Promise<StoreShape> {
  try {
    return await readStore();
  } catch (error) {
    console.error("[menu] falling back to seeded menu:", error);
    return buildSeed();
  }
}

/**
 * Allergens a dish contains: the ones flagged by hand on the dish, unioned
 * with whatever its recipe's ingredients carry. Both on purpose — a manual
 * flag covers a dish with no recipe yet, the recipe covers an ingredient
 * someone forgot to flag, and for allergen information under-reporting is
 * the dangerous direction. Optional recipe lines count too: they may be in
 * the dish. Ordered the way the admin's allergen list is (statutory first).
 */
function allergensFor(
  item: StoreShape["items"][number],
  data: StoreShape
): { id: string; label: string }[] {
  const ids = new Set(item.allergenIds ?? []);

  const recipe = (data.recipes ?? []).find((r) => r.menuItemSlug === item.slug);
  if (recipe) {
    const byId = new Map((data.ingredients ?? []).map((i) => [i.id, i]));
    for (const line of recipe.lines) {
      for (const allergen of byId.get(line.ingredientId)?.allergens ?? []) {
        ids.add(allergen);
      }
    }
  }

  return (data.allergens ?? [])
    .filter((a) => ids.has(a.id))
    .map((a) => ({ id: a.id, label: a.label }));
}

function toPublicItem(
  item: StoreShape["items"][number],
  groups: StoredOptionGroup[],
  data: StoreShape
): PublicMenuItem {
  const media = data.media ?? [];
  // An uploaded photo wins; otherwise the stock placeholder keyed by slug.
  const uploaded = item.imageIds?.length
    ? media.find((m) => m.id === item.imageIds[0])?.url
    : undefined;

  return {
    slug: item.slug,
    name: item.name,
    price: item.price,
    variants: item.variants ?? [],
    vegetarian: item.vegetarian,
    spicy: item.spicy,
    soldOut: item.soldOut,
    image: uploaded ?? dishImage(item.slug),
    description: item.description ?? "",
    videoUrl: item.videoUrl ?? "",
    allergens: allergensFor(item, data),
    optionGroups: (item.optionGroupIds ?? [])
      .map((id) => groups.find((g) => g.id === id))
      .filter((g): g is StoredOptionGroup => Boolean(g))
      .map((g) => ({
        id: g.id,
        label: g.label,
        minChoices: g.minChoices,
        maxChoices: g.maxChoices,
        options: g.options.map((o) => ({
          id: o.id,
          label: o.label,
          price: o.price,
        })),
      })),
  };
}

export async function getPublicMenu(): Promise<PublicMenuCategory[]> {
  const data = await read();

  return [...data.categories]
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      id: category.id,
      label: category.label,
      description: category.description,
      items: data.items
        .filter((i) => i.categoryId === category.id && i.visible)
        .map((i) => toPublicItem(i, data.optionGroups ?? [], data)),
    }))
    .filter((c) => c.items.length > 0);
}

export async function getPublicItem(slug: string): Promise<{
  item: PublicMenuItem;
  category: { id: string; label: string };
} | null> {
  const data = await read();
  const item = data.items.find((i) => i.slug === slug);
  if (!item || !item.visible) return null;

  const category = data.categories.find((c) => c.id === item.categoryId);
  if (!category?.visible) return null;

  return {
    item: toPublicItem(item, data.optionGroups ?? [], data),
    category: { id: category.id, label: category.label },
  };
}

/** Slugs for generateStaticParams on the item pages. */
export async function getPublicItemSlugs(): Promise<string[]> {
  const data = await read();
  const visibleCategories = new Set(
    data.categories.filter((c) => c.visible).map((c) => c.id)
  );
  return data.items
    .filter((i) => i.visible && visibleCategories.has(i.categoryId))
    .map((i) => i.slug);
}
