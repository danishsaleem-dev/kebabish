import { jsonAdapter } from "@/lib/admin/store/json-adapter";
import { supabaseAdapter } from "@/lib/admin/store/supabase-adapter";
import { buildSeed } from "@/lib/admin/store/seed";
import type {
  StoreAdapter,
  StoreShape,
  StoredAllergen,
  StoredMedia,
  StoredSettings,
  StoredCategory,
  StoredIngredient,
  StoredItem,
  StoredOptionGroup,
  StoredRecipe,
} from "@/lib/admin/store/types";

/**
 * The single place the backend is chosen.
 *
 * Supabase whenever it's configured, including local dev — what you see
 * locally is then what the live site serves. The JSON file is the fallback
 * for a checkout with no keys (fresh clone, CI), where booting with seeded
 * data beats crashing. It cannot be the production store: Vercel's
 * filesystem is read-only at runtime.
 *
 * `STORE_ADAPTER=json` in .env.local forces the file store even when keys
 * are present. Without that escape hatch, `npm run dev` edits the real
 * shop's live menu — fine when that's what you meant, bad by accident.
 */
const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const adapter: StoreAdapter =
  hasSupabase && process.env.STORE_ADAPTER !== "json"
    ? supabaseAdapter
    : jsonAdapter;

/**
 * Documents written before a field existed are still out there — in
 * Supabase, and in anyone's local .data file. Backfill the newer fields on
 * read so nothing above the store has to null-check them.
 */
function normalise(data: StoreShape): StoreShape {
  data.optionGroups ??= [];
  for (const item of data.items) {
    item.optionGroupIds ??= [];
    item.tags ??= [];
    item.allergenIds ??= [];
    item.visible ??= true;
  }
  return data;
}

export const readStore = async (): Promise<StoreShape> =>
  normalise(await adapter.read());

async function mutate<T>(fn: (data: StoreShape) => T | Promise<T>): Promise<T> {
  const data = await readStore();
  const result = await fn(data);
  await adapter.write(data);
  return result;
}

/** URL-safe id from a display name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // strip combining accents so "Shoarma Spécial" -> "shoarma-special"
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Append -2, -3 … until the id is free. */
function uniqueId(base: string, taken: string[]): string {
  const seed = base || "item";
  if (!taken.includes(seed)) return seed;
  let n = 2;
  while (taken.includes(`${seed}-${n}`)) n++;
  return `${seed}-${n}`;
}

/* ---------------------------------------------------------------- categories */

export async function listCategories(): Promise<StoredCategory[]> {
  const { categories } = await readStore();
  return [...categories].sort((a, b) => a.position - b.position);
}

export async function getCategory(id: string) {
  const { categories } = await readStore();
  return categories.find((c) => c.id === id);
}

export async function createCategory(
  input: Omit<StoredCategory, "id" | "position">
) {
  return mutate((data) => {
    const id = uniqueId(
      slugify(input.label),
      data.categories.map((c) => c.id)
    );
    const position = Math.max(0, ...data.categories.map((c) => c.position)) + 1;
    const category: StoredCategory = { ...input, id, position };
    data.categories.push(category);
    return category;
  });
}

export async function updateCategory(
  id: string,
  input: Partial<Omit<StoredCategory, "id">>
) {
  return mutate((data) => {
    const category = data.categories.find((c) => c.id === id);
    if (!category) throw new Error(`Category "${id}" not found`);
    Object.assign(category, input);
    return category;
  });
}

export async function deleteCategory(id: string) {
  return mutate((data) => {
    const used = data.items.filter((i) => i.categoryId === id).length;
    if (used > 0) {
      throw new Error(
        `Move or delete its ${used} item${used === 1 ? "" : "s"} first.`
      );
    }
    data.categories = data.categories.filter((c) => c.id !== id);
    // Close the gap so positions stay 1..n.
    data.categories
      .sort((a, b) => a.position - b.position)
      .forEach((c, i) => (c.position = i + 1));
  });
}

/** Move a category one step up or down the public menu order. */
export async function moveCategory(id: string, direction: "up" | "down") {
  return mutate((data) => {
    const sorted = [...data.categories].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((c) => c.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= sorted.length) return;

    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    sorted.forEach((c, i) => (c.position = i + 1));
  });
}

/* --------------------------------------------------------------------- items */

export async function listItems(): Promise<StoredItem[]> {
  const { items } = await readStore();
  return items;
}

export async function getItem(slug: string) {
  const { items } = await readStore();
  return items.find((i) => i.slug === slug);
}

export async function createItem(input: Omit<StoredItem, "slug">) {
  return mutate((data) => {
    const slug = uniqueId(
      slugify(input.name),
      data.items.map((i) => i.slug)
    );
    const item: StoredItem = { ...input, slug };
    data.items.push(item);
    return item;
  });
}

export async function updateItem(
  slug: string,
  input: Partial<Omit<StoredItem, "slug">>
) {
  return mutate((data) => {
    const item = data.items.find((i) => i.slug === slug);
    if (!item) throw new Error(`Item "${slug}" not found`);
    Object.assign(item, input);
    return item;
  });
}

export async function deleteItem(slug: string) {
  return mutate((data) => {
    data.items = data.items.filter((i) => i.slug !== slug);
    // A recipe without its dish is orphaned data.
    data.recipes = data.recipes.filter((r) => r.menuItemSlug !== slug);
  });
}

/* -------------------------------------------------------------- option groups */

export async function listOptionGroups(): Promise<StoredOptionGroup[]> {
  const { optionGroups } = await readStore();
  return [...optionGroups].sort((a, b) => a.label.localeCompare(b.label));
}

export async function getOptionGroup(id: string) {
  const { optionGroups } = await readStore();
  return optionGroups.find((g) => g.id === id);
}

export async function createOptionGroup(input: Omit<StoredOptionGroup, "id">) {
  return mutate((data) => {
    const id = uniqueId(
      slugify(input.label),
      data.optionGroups.map((g) => g.id)
    );
    const group: StoredOptionGroup = { ...input, id };
    data.optionGroups.push(group);
    return group;
  });
}

export async function updateOptionGroup(
  id: string,
  input: Partial<Omit<StoredOptionGroup, "id">>
) {
  return mutate((data) => {
    const group = data.optionGroups.find((g) => g.id === id);
    if (!group) throw new Error(`Option group "${id}" not found`);
    Object.assign(group, input);
    return group;
  });
}

export async function deleteOptionGroup(id: string) {
  return mutate((data) => {
    data.optionGroups = data.optionGroups.filter((g) => g.id !== id);
    // Detach from every dish that offered it, so no item points at a group
    // that no longer exists.
    for (const item of data.items) {
      item.optionGroupIds = item.optionGroupIds.filter((g) => g !== id);
    }
  });
}

/** Dishes currently offering a group — shown before deleting one. */
export async function itemsUsingOptionGroup(id: string): Promise<StoredItem[]> {
  const { items } = await readStore();
  return items.filter((i) => i.optionGroupIds.includes(id));
}

/* --------------------------------------------------------------------- media */

export async function listMedia(): Promise<StoredMedia[]> {
  const { media } = await readStore();
  // Newest first — you almost always want what you just uploaded.
  return [...(media ?? [])].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt)
  );
}

export async function getMedia(id: string) {
  const { media } = await readStore();
  return media?.find((m) => m.id === id);
}

/** Resolve a list of ids to media records, preserving the given order. */
export async function getMediaByIds(ids: string[]): Promise<StoredMedia[]> {
  const { media } = await readStore();
  const byId = new Map((media ?? []).map((m) => [m.id, m]));
  return ids.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}

export async function addMedia(record: Omit<StoredMedia, "id" | "uploadedAt">) {
  return mutate((data) => {
    data.media ??= [];
    const id = uniqueId(
      slugify(record.filename.replace(/\.[^.]+$/, "")),
      data.media.map((m) => m.id)
    );
    const media: StoredMedia = {
      ...record,
      id,
      uploadedAt: new Date().toISOString(),
    };
    data.media.push(media);
    return media;
  });
}

export async function updateMedia(id: string, alt: string) {
  return mutate((data) => {
    const media = data.media?.find((m) => m.id === id);
    if (!media) throw new Error(`Image "${id}" not found`);
    media.alt = alt;
    return media;
  });
}

/** Where an image is in use — deleting silently would break those screens. */
export async function mediaUsage(id: string) {
  const { items, categories } = await readStore();
  return {
    items: items.filter((i) => i.imageIds?.includes(id)).map((i) => i.name),
    categories: categories
      .filter((c) => c.imageId === id)
      .map((c) => c.label),
  };
}

export async function deleteMedia(id: string) {
  return mutate((data) => {
    // Detach from anything using it rather than leaving dangling ids.
    data.items.forEach((item) => {
      item.imageIds = (item.imageIds ?? []).filter((mid) => mid !== id);
    });
    data.categories.forEach((category) => {
      if (category.imageId === id) delete category.imageId;
    });
    data.media = (data.media ?? []).filter((m) => m.id !== id);
  });
}

/* ------------------------------------------------------------------ settings */

export async function getSettings(): Promise<StoredSettings> {
  const { settings } = await readStore();
  return settings;
}

/**
 * Settings for the public storefront, which reads them on every page.
 *
 * The admin panel should fail loudly when the store is unreachable — that's
 * how Danish finds out a migration hasn't been run. The shop front should
 * not: a database hiccup taking kebabish.nl down, rather than serving the
 * menu with default hours, is the worse failure. Logged so it's still
 * visible in the Vercel logs.
 */
export async function getPublicSettings(): Promise<StoredSettings> {
  try {
    return await getSettings();
  } catch (error) {
    console.error("[store] falling back to default settings:", error);
    return buildSeed().settings;
  }
}

export async function updateSettings(patch: Partial<StoredSettings>) {
  return mutate((data) => {
    data.settings = { ...data.settings, ...patch };
    return data.settings;
  });
}

/* ----------------------------------------------------------------- allergens */

export async function listAllergens(): Promise<StoredAllergen[]> {
  const { allergens } = await readStore();
  // Statutory ones first, then custom, each alphabetical.
  return [...(allergens ?? [])].sort(
    (a, b) =>
      Number(b.statutory) - Number(a.statutory) || a.label.localeCompare(b.label)
  );
}

export async function createAllergen(label: string) {
  return mutate((data) => {
    data.allergens ??= [];
    const id = uniqueId(
      slugify(label),
      data.allergens.map((a) => a.id)
    );
    const allergen: StoredAllergen = { id, label, statutory: false };
    data.allergens.push(allergen);
    return allergen;
  });
}

export async function updateAllergen(id: string, label: string) {
  return mutate((data) => {
    const allergen = data.allergens?.find((a) => a.id === id);
    if (!allergen) throw new Error(`Allergen "${id}" not found`);
    allergen.label = label;
    return allergen;
  });
}

export async function deleteAllergen(id: string) {
  return mutate((data) => {
    const allergen = data.allergens?.find((a) => a.id === id);
    if (!allergen) return;
    if (allergen.statutory) {
      throw new Error("EU-required allergens can't be deleted.");
    }

    const used = data.ingredients.filter((i) =>
      i.allergens.includes(id)
    ).length;
    if (used > 0) {
      throw new Error(
        `Tagged on ${used} ingredient${used === 1 ? "" : "s"}. Untag it there first.`
      );
    }

    data.allergens = data.allergens.filter((a) => a.id !== id);
  });
}

/* --------------------------------------------------------------- ingredients */

export async function listIngredients(): Promise<StoredIngredient[]> {
  const { ingredients } = await readStore();
  return [...ingredients].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getIngredient(id: string) {
  const { ingredients } = await readStore();
  return ingredients.find((i) => i.id === id);
}

export async function createIngredient(input: Omit<StoredIngredient, "id">) {
  return mutate((data) => {
    const id = uniqueId(
      slugify(input.name),
      data.ingredients.map((i) => i.id)
    );
    const ingredient: StoredIngredient = { ...input, id };
    data.ingredients.push(ingredient);
    return ingredient;
  });
}

export async function updateIngredient(
  id: string,
  input: Partial<Omit<StoredIngredient, "id">>
) {
  return mutate((data) => {
    const ingredient = data.ingredients.find((i) => i.id === id);
    if (!ingredient) throw new Error(`Ingredient "${id}" not found`);
    Object.assign(ingredient, input);
    return ingredient;
  });
}

export async function deleteIngredient(id: string) {
  return mutate((data) => {
    const usedBy = data.recipes.filter((r) =>
      r.lines.some((l) => l.ingredientId === id)
    );
    if (usedBy.length > 0) {
      throw new Error(
        `Used by ${usedBy.length} recipe${usedBy.length === 1 ? "" : "s"}. Remove it there first.`
      );
    }
    data.ingredients = data.ingredients.filter((i) => i.id !== id);
  });
}

/* ------------------------------------------------------------------- recipes */

export async function listRecipes(): Promise<StoredRecipe[]> {
  const { recipes } = await readStore();
  return recipes;
}

export async function getRecipe(menuItemSlug: string) {
  const { recipes } = await readStore();
  return recipes.find((r) => r.menuItemSlug === menuItemSlug);
}

/** Create or replace a dish's recipe. */
export async function saveRecipe(recipe: StoredRecipe) {
  return mutate((data) => {
    const index = data.recipes.findIndex(
      (r) => r.menuItemSlug === recipe.menuItemSlug
    );
    if (index === -1) data.recipes.push(recipe);
    else data.recipes[index] = recipe;
    return recipe;
  });
}

export async function deleteRecipe(menuItemSlug: string) {
  return mutate((data) => {
    data.recipes = data.recipes.filter((r) => r.menuItemSlug !== menuItemSlug);
  });
}
