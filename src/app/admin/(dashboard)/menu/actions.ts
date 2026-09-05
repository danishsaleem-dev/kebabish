"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createAllergen,
  createCategory,
  createIngredient,
  createItem,
  deleteAllergen,
  deleteCategory,
  deleteIngredient,
  deleteItem,
  deleteRecipe,
  moveCategory,
  saveRecipe,
  updateAllergen,
  updateCategory,
  updateIngredient,
  updateItem,
} from "@/lib/admin/store";
import type { IngredientGroup } from "@/lib/admin/ingredients";
import type { Unit } from "@/lib/admin/units";
import { flashRedirect } from "@/lib/admin/flash";

/**
 * Server actions for everything under /admin/menu.
 *
 * Each returns a `FormState` so the form can render field-level errors
 * inline instead of throwing. Validation is zod (already a dependency) —
 * the same schemas will guard the Supabase writes later.
 */

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
const GROUPS = [
  "meat",
  "produce",
  "dairy",
  "dry-goods",
  "spices",
  "oils",
  "packaging",
] as const;

/** Turn a ZodError into { field: message } for inline display. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

function refreshMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/admin/menu/categories");
  revalidatePath("/admin/menu/ingredients");
  revalidatePath("/admin/menu/production");
  revalidatePath("/admin/media");
}

/* ---------------------------------------------------------------- categories */

const categorySchema = z.object({
  label: z.string().trim().min(2, "Give the category a name."),
  description: z.string().trim().max(200, "Keep this under 200 characters.").default(""),
  visible: z.boolean(),
  imageId: z.string().trim().optional(),
});

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = categorySchema.safeParse({
    label: formData.get("label"),
    description: formData.get("description") ?? "",
    visible: formData.get("visible") === "on",
    imageId: String(formData.get("imageId") ?? "") || undefined,
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const category = await createCategory(parsed.data);
  refreshMenu();
  redirect(
    flashRedirect("/admin/menu/categories", `“${category.label}” created.`)
  );
}

export async function updateCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = categorySchema.safeParse({
    label: formData.get("label"),
    description: formData.get("description") ?? "",
    visible: formData.get("visible") === "on",
    // Empty string means "cleared", so it must overwrite rather than be dropped.
    imageId: String(formData.get("imageId") ?? "") || undefined,
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const updated = await updateCategory(id, {
    ...parsed.data,
    imageId: parsed.data.imageId,
  });
  refreshMenu();
  redirect(
    flashRedirect("/admin/menu/categories", `“${updated.label}” saved.`)
  );
}

export async function deleteCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await deleteCategory(String(formData.get("id") ?? ""));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not delete category.",
    };
  }
  refreshMenu();
  return { ok: true, message: "Category deleted." };
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveCategory(id, direction);
  refreshMenu();
}

/* --------------------------------------------------------------------- items */

const itemSchema = z.object({
  name: z.string().trim().min(2, "Give the dish a name."),
  categoryId: z.string().trim().min(1, "Pick a category."),
  price: z
    .union([z.literal(""), z.coerce.number().min(0, "Price can't be negative.")])
    .transform((v) => (v === "" ? null : Number(v))),
  variants: z
    .string()
    .default("")
    .transform((v) =>
      v.split(",").map((s) => s.trim()).filter(Boolean)
    ),
  vegetarian: z.boolean(),
  spicy: z.boolean(),
  soldOut: z.boolean(),
  imageIds: z.array(z.string()),
  optionGroupIds: z.array(z.string()),
});

function readItemForm(formData: FormData) {
  return itemSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    price: formData.get("price") ?? "",
    variants: formData.get("variants") ?? "",
    vegetarian: formData.get("vegetarian") === "on",
    spicy: formData.get("spicy") === "on",
    soldOut: formData.get("soldOut") === "on",
    imageIds: formData.getAll("imageIds").map(String).filter(Boolean),
    optionGroupIds: formData
      .getAll("optionGroupIds")
      .map(String)
      .filter(Boolean),
  });
}

export async function createItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = readItemForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const item = await createItem(parsed.data);
  refreshMenu();
  redirect(
    flashRedirect(`/admin/menu/recipes/${item.slug}`, `“${item.name}” added to the menu.`)
  );
}

export async function updateItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const parsed = readItemForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const item = await updateItem(slug, parsed.data);
  refreshMenu();
  revalidatePath(`/admin/menu/recipes/${slug}`);
  redirect(
    flashRedirect(`/admin/menu/recipes/${slug}`, `“${item.name}” saved.`)
  );
}

export async function deleteItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await deleteItem(String(formData.get("slug") ?? ""));
  refreshMenu();
  redirect(flashRedirect("/admin/menu", "Dish deleted."));
}

/* --------------------------------------------------------------- ingredients */

const ingredientSchema = z.object({
  name: z.string().trim().min(2, "Give the ingredient a name."),
  group: z.enum(GROUPS),
  unit: z.enum(UNITS),
  costPerUnit: z.coerce
    .number()
    .min(0, "Cost can't be negative.")
    .max(100000, "That looks like a typo."),
  allergens: z.array(z.string()),
  supplier: z.string().trim().optional(),
});

function readIngredientForm(formData: FormData) {
  return ingredientSchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group"),
    unit: formData.get("unit"),
    costPerUnit: formData.get("costPerUnit") || 0,
    allergens: formData.getAll("allergens").map(String),
    supplier: formData.get("supplier") || undefined,
  });
}

export async function createIngredientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = readIngredientForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await createIngredient({
    ...parsed.data,
    group: parsed.data.group as IngredientGroup,
    unit: parsed.data.unit as Unit,
  });
  refreshMenu();
  redirect(
    flashRedirect("/admin/menu/ingredients", `“${parsed.data.name}” added.`)
  );
}

export async function updateIngredientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = readIngredientForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await updateIngredient(id, {
    ...parsed.data,
    group: parsed.data.group as IngredientGroup,
    unit: parsed.data.unit as Unit,
  });
  refreshMenu();
  redirect(
    flashRedirect("/admin/menu/ingredients", `“${parsed.data.name}” saved.`)
  );
}

export async function deleteIngredientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await deleteIngredient(String(formData.get("id") ?? ""));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not delete ingredient.",
    };
  }
  refreshMenu();
  return { ok: true, message: "Ingredient deleted." };
}

/* ----------------------------------------------------------------- allergens */

const allergenSchema = z.object({
  label: z.string().trim().min(2, "Give the allergen a name."),
});

export async function createAllergenAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = allergenSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await createAllergen(parsed.data.label);
  refreshMenu();
  revalidatePath("/admin/menu/allergens");
  return { ok: true, message: `Added “${parsed.data.label}”.` };
}

export async function updateAllergenAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = allergenSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await updateAllergen(String(formData.get("id") ?? ""), parsed.data.label);
  refreshMenu();
  revalidatePath("/admin/menu/allergens");
  return { ok: true, message: "Renamed." };
}

export async function deleteAllergenAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await deleteAllergen(String(formData.get("id") ?? ""));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not delete allergen.",
    };
  }
  refreshMenu();
  revalidatePath("/admin/menu/allergens");
  return { ok: true, message: "Allergen deleted." };
}

/* ------------------------------------------------------------------- recipes */

const recipeSchema = z.object({
  menuItemSlug: z.string().min(1),
  portionWeightG: z.coerce.number().positive("Portion weight must be above 0."),
  batchPortions: z.coerce
    .number()
    .int("Whole portions only.")
    .positive("The batch must make at least 1 portion."),
  prepMinutes: z.coerce.number().min(0).default(0),
  cookMinutes: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
});

export async function saveRecipeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = recipeSchema.safeParse({
    menuItemSlug: formData.get("menuItemSlug"),
    portionWeightG: formData.get("portionWeightG"),
    batchPortions: formData.get("batchPortions"),
    prepMinutes: formData.get("prepMinutes") || 0,
    cookMinutes: formData.get("cookMinutes") || 0,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  // Ingredient lines arrive as parallel arrays from the repeatable fieldset.
  const ids = formData.getAll("lineIngredientId").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const units = formData.getAll("lineUnit").map(String);
  const notes = formData.getAll("lineNote").map(String);
  const optionalFlags = formData.getAll("lineOptional").map(String);

  const lines = ids.flatMap((ingredientId, i) => {
    const quantity = Number(quantities[i]);
    if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) return [];
    const unit = UNITS.includes(units[i] as Unit) ? (units[i] as Unit) : "g";
    return [
      {
        ingredientId,
        quantity,
        unit,
        note: notes[i]?.trim() || undefined,
        optional: optionalFlags[i] === "true" || undefined,
      },
    ];
  });

  if (lines.length === 0) {
    return { ok: false, message: "Add at least one ingredient line." };
  }

  const steps = String(formData.get("steps") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  await saveRecipe({ ...parsed.data, lines, steps });

  refreshMenu();
  revalidatePath(`/admin/menu/recipes/${parsed.data.menuItemSlug}`);
  redirect(
    flashRedirect(
      `/admin/menu/recipes/${parsed.data.menuItemSlug}`,
      "Recipe saved."
    )
  );
}

export async function deleteRecipeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = String(formData.get("menuItemSlug") ?? "");
  await deleteRecipe(slug);
  refreshMenu();
  revalidatePath(`/admin/menu/recipes/${slug}`);
  return { ok: true, message: "Recipe deleted." };
}
