"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OWNER_STAFF, OWNER_STAFF_MANAGER, requireRole } from "@/lib/admin/guard";
import { PAIRS_LIMIT } from "@/lib/admin/store/types";
import {
  createAllergen,
  createCategory,
  createIngredient,
  createItem,
  createOptionGroup,
  deleteAllergen,
  deleteCategory,
  deleteIngredient,
  deleteItem,
  deleteOptionGroup,
  deleteRecipe,
  getItem,
  moveCategory,
  moveItem,
  listItems,
  saveRecipe,
  slugify,
  updateAllergen,
  updateCategory,
  updateIngredient,
  updateItem,
  updateOptionGroup,
} from "@/lib/admin/store";
import type { IngredientGroup } from "@/lib/admin/ingredients";
import type { Unit } from "@/lib/admin/units";
import { MIN_DISH_PRICE } from "@/lib/money";
import { FEATURED_LIMIT } from "@/lib/featured";
import { flashRedirect } from "@/lib/admin/flash";
import { deleteVideoByUrl, isOwnVideoUrl } from "@/lib/admin/videos";
import { readStockMap, setItemStock } from "@/lib/stock";
import { DEFAULT_LOW_THRESHOLD, type StockEntry } from "@/lib/stock-status";

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
  revalidatePath("/admin/menu/extras");
  revalidatePath("/admin/menu/production");
  revalidatePath("/admin/media");
  // The public menu renders from this same store now.
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
}

/* ---------------------------------------------------------------- categories */

const categorySchema = z.object({
  label: z.string().trim().min(2, "Give the category a name."),
  labelEn: z.string().trim().max(60, "Keep this under 60 characters.").default(""),
  description: z.string().trim().max(200, "Keep this under 200 characters.").default(""),
  visible: z.boolean(),
  imageId: z.string().trim().optional(),
});

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const parsed = categorySchema.safeParse({
    label: formData.get("label"),
    labelEn: formData.get("labelEn") ?? "",
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
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  const parsed = categorySchema.safeParse({
    label: formData.get("label"),
    labelEn: formData.get("labelEn") ?? "",
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveCategory(id, direction);
  refreshMenu();
}

/* --------------------------------------------------------------------- items */

const itemSchema = z.object({
  name: z.string().trim().min(2, "Give the dish a name."),
  nameEn: z.string().trim().max(80, "Keep the English name under 80 characters.").default(""),
  portion: z.string().trim().max(40, "Keep the portion short, e.g. 500 g.").default(""),
  featured: z.boolean(),
  categoryId: z.string().trim().min(1, "Pick a category."),
  price: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .min(0, "Price can't be negative.")
        .refine(
          (v) => v === 0 || v >= MIN_DISH_PRICE,
          `Prices under €${MIN_DISH_PRICE.toFixed(2)} aren't sold — leave it empty until you have the real price.`
        ),
    ])
    .transform((v) => (v === "" ? null : Number(v))),
  variants: z
    .string()
    .default("")
    .transform((v) =>
      v.split(",").map((s) => s.trim()).filter(Boolean)
    ),
  description: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(1500, "Keep the description under 1500 characters.")),
  descriptionEn: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(1500, "Keep the description under 1500 characters.")),
  videoUrl: z
    .string()
    .default("")
    .refine(
      (v) => v === "" || isOwnVideoUrl(v),
      "That video isn't valid — upload it again."
    ),
  vegetarian: z.boolean(),
  spicy: z.boolean(),
  spiceLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  chefsPick: z.boolean(),
  soldOut: z.boolean(),
  visible: z.boolean(),
  imageIds: z.array(z.string()),
  optionGroupIds: z.array(z.string()),
  tags: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  allergenIds: z.array(z.string()),
  pairsWith: z.array(z.string()).max(PAIRS_LIMIT, `Pick at most ${PAIRS_LIMIT} dishes.`),
});

/**
 * The "Spice level" select: "0"–"3", or "legacy" for an older dish that was only ever
 * marked "spicy" and has no level yet — kept exactly as it was until one is picked, so
 * saving some other field never invents a heat level for it.
 */
function readSpice(formData: FormData): { spicy: boolean; spiceLevel?: 0 | 1 | 2 | 3 } {
  const raw = String(formData.get("spiceLevel") ?? "0");
  if (raw === "legacy") return { spicy: true, spiceLevel: undefined };
  const level = Number(raw);
  const safe = level === 1 || level === 2 || level === 3 ? level : 0;
  return { spicy: safe > 0, spiceLevel: safe };
}

function readItemForm(formData: FormData) {
  return itemSchema.safeParse({
    ...readSpice(formData),
    chefsPick: formData.get("chefsPick") === "on",
    name: formData.get("name"),
    nameEn: formData.get("nameEn") ?? "",
    portion: formData.get("portion") ?? "",
    featured: formData.get("featured") === "on",
    descriptionEn: formData.get("descriptionEn") ?? "",
    categoryId: formData.get("categoryId"),
    price: formData.get("price") ?? "",
    variants: formData.get("variants") ?? "",
    description: formData.get("description") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    vegetarian: formData.get("vegetarian") === "on",
    soldOut: formData.get("soldOut") === "on",
    visible: formData.get("visible") === "on",
    imageIds: formData.getAll("imageIds").map(String).filter(Boolean),
    optionGroupIds: formData
      .getAll("optionGroupIds")
      .map(String)
      .filter(Boolean),
    tags: formData.get("tags") ?? "",
    allergenIds: formData.getAll("allergenIds").map(String).filter(Boolean),
    pairsWith: formData.getAll("pairsWith").map(String).filter(Boolean),
  });
}

/**
 * The "Stock" card of the dish editor. Read apart from the dish itself because stock lives in its own
 * table (lib/stock.ts), not in the menu document. `present: false` = the card wasn't on the form
 * (stock isn't set up yet), so nothing is touched.
 */
function readStockForm(
  formData: FormData
): { present: false } | { present: true; entry: StockEntry | null } | { errors: Record<string, string> } {
  if (formData.get("stockPresent") !== "1") return { present: false };
  if (formData.get("stockTrack") !== "on") return { present: true, entry: null };

  const whole = /^\d{1,6}$/;
  const qty = String(formData.get("stockQty") ?? "").trim();
  const low = String(formData.get("stockLow") ?? "").trim() || String(DEFAULT_LOW_THRESHOLD);
  const errors: Record<string, string> = {};
  if (!whole.test(qty)) errors.stockQty = "Enter how many are in stock — a whole number, 0 or more.";
  if (!whole.test(low)) errors.stockLow = "Enter a whole number, 0 or more (0 = never warn).";
  if (Object.keys(errors).length > 0) return { errors };
  return { present: true, entry: { quantity: Number(qty), lowThreshold: Number(low) } };
}

/**
 * At most FEATURED_LIMIT dishes can be featured — the homepage has room for
 * that many. Counted over every *other* dish, so re-saving an already
 * featured dish never trips it.
 */
async function featuredLimitError(
  featured: boolean,
  exceptSlug?: string
): Promise<Record<string, string> | null> {
  if (!featured) return null;
  const others = (await listItems()).filter(
    (i) => i.featured && i.slug !== exceptSlug
  ).length;
  return others >= FEATURED_LIMIT
    ? {
        featured: `Only ${FEATURED_LIMIT} dishes can be featured on the homepage — untick another one first.`,
      }
    : null;
}

export async function createItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF_MANAGER);
  const parsed = readItemForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const tooMany = await featuredLimitError(parsed.data.featured);
  if (tooMany) return { ok: false, errors: tooMany };
  const stockForm = readStockForm(formData);
  if ("errors" in stockForm) return { ok: false, errors: stockForm.errors };

  const item = await createItem(parsed.data);
  if (stockForm.present && stockForm.entry) {
    try {
      await setItemStock(item.slug, stockForm.entry);
    } catch (error) {
      console.error("[menu] the dish was added but its stock couldn't be saved:", error);
    }
  }
  refreshMenu();
  redirect(
    flashRedirect(`/admin/menu/items/${item.slug}/edit`, `“${item.name}” added to the menu.`)
  );
}

export async function updateItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF_MANAGER);
  const slug = String(formData.get("slug") ?? "");
  const parsed = readItemForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const tooMany = await featuredLimitError(parsed.data.featured, slug);
  if (tooMany) return { ok: false, errors: tooMany };
  const stockForm = readStockForm(formData);
  if ("errors" in stockForm) return { ok: false, errors: stockForm.errors };

  const previous = await getItem(slug);
  const item = await updateItem(slug, parsed.data);
  if (stockForm.present) {
    try {
      await setItemStock(slug, stockForm.entry);
    } catch (error) {
      console.error("[menu] the dish was saved but its stock couldn't be saved:", error);
      return { ok: false, message: "The dish was saved, but its stock couldn't be — please try the stock again." };
    }
  }
  // The video was replaced or removed — drop the file it was using.
  if (previous?.videoUrl && previous.videoUrl !== parsed.data.videoUrl) {
    await deleteVideoByUrl(previous.videoUrl);
  }
  refreshMenu();
  revalidatePath(`/admin/menu/recipes/${slug}`);
  redirect(
    flashRedirect(`/admin/menu/items/${slug}/edit`, `“${item.name}” saved.`)
  );
}

export async function deleteItemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF_MANAGER);
  const slug = String(formData.get("slug") ?? "");
  const previous = await getItem(slug);
  await deleteItem(slug);
  await deleteVideoByUrl(previous?.videoUrl);
  await setItemStock(slug, null).catch(() => {});
  refreshMenu();
  redirect(flashRedirect("/admin/menu", "Dish deleted."));
}

/** Up/down arrows in the items table — reorders within the dish's category. */
export async function moveItemAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF_MANAGER);
  const slug = String(formData.get("slug") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveItem(slug, direction);
  refreshMenu();
}

/** Inline "show on website" toggle in the items table — no full edit needed. */
export async function toggleItemVisibilityAction(
  formData: FormData
): Promise<void> {
  await requireRole(OWNER_STAFF_MANAGER);
  const slug = String(formData.get("slug") ?? "");
  const visible = formData.get("visible") === "true";
  await updateItem(slug, { visible: !visible });
  refreshMenu();
}

/**
 * Quick stock edit in the items table. "set" makes the number exactly N; "add" puts a new batch on
 * top of what is there. A dish that doesn't track stock yet starts tracking (warning level 5).
 */
export async function setStockAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF_MANAGER);
  const slug = String(formData.get("slug") ?? "");
  const mode = formData.get("mode") === "add" ? "add" : "set";
  const raw = String(formData.get("quantity") ?? "").trim();
  if (!/^\d{1,6}$/.test(raw)) return;
  const amount = Number(raw);

  const [item, stock] = await Promise.all([getItem(slug), readStockMap()]);
  if (!item || !stock) return; // unknown dish, or stock tracking isn't set up yet
  const current = stock.get(slug);
  await setItemStock(slug, {
    quantity: mode === "add" ? (current?.quantity ?? 0) + amount : amount,
    lowThreshold: current?.lowThreshold ?? DEFAULT_LOW_THRESHOLD,
  });
  refreshMenu();
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
  stockQuantity: z.coerce.number().min(0, "Quantity can't be negative.").max(10_000_000).optional(),
  stockTotalCost: z.coerce.number().min(0, "Price can't be negative.").max(10_000_000).optional(),
  allergens: z.array(z.string()),
  supplier: z.string().trim().optional(),
});

function readIngredientForm(formData: FormData) {
  const blank = (v: FormDataEntryValue | null) =>
    v === null || String(v).trim() === "" ? undefined : v;
  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group"),
    unit: formData.get("unit"),
    costPerUnit: formData.get("costPerUnit") || 0,
    stockQuantity: blank(formData.get("stockQuantity")),
    stockTotalCost: blank(formData.get("stockTotalCost")),
    allergens: formData.getAll("allergens").map(String),
    supplier: formData.get("supplier") || undefined,
  });
  if (!parsed.success) return parsed;
  // Total price ÷ total quantity is the price per unit every costing figure uses. It is worked
  // out here, not trusted from the browser, so the two can never disagree.
  const { stockQuantity, stockTotalCost } = parsed.data;
  if (stockQuantity && stockQuantity > 0 && stockTotalCost !== undefined) {
    parsed.data.costPerUnit = Math.round((stockTotalCost / stockQuantity) * 10000) / 10000;
  }
  return parsed;
}

export async function createIngredientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
  await requireRole(OWNER_STAFF);
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
      `/admin/menu/items/${parsed.data.menuItemSlug}/edit`,
      "Recipe saved."
    )
  );
}

export async function deleteRecipeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const slug = String(formData.get("menuItemSlug") ?? "");
  await deleteRecipe(slug);
  refreshMenu();
  revalidatePath(`/admin/menu/recipes/${slug}`);
  return { ok: true, message: "Recipe deleted." };
}

/* ------------------------------------------------------------- option groups */

const optionSchema = z.object({
  label: z.string().trim().min(1, "Every option needs a name."),
  labelEn: z.string().trim().max(60).default(""),
  price: z.coerce
    .number()
    .min(0, "A surcharge can't be negative.")
    .max(100, "That looks like a typo."),
});

const optionGroupSchema = z
  .object({
    label: z.string().trim().min(2, "Give the group a name."),
    labelEn: z.string().trim().max(60, "Keep this under 60 characters.").default(""),
    minChoices: z.coerce.number().int().min(0).max(20),
    maxChoices: z.coerce.number().int().min(1).max(20),
    options: z.array(optionSchema).min(1, "Add at least one option."),
  })
  .refine((g) => g.maxChoices >= g.minChoices, {
    message: "The maximum can't be lower than the minimum.",
    path: ["maxChoices"],
  })
  .refine((g) => g.minChoices <= g.options.length, {
    message: "You're requiring more choices than there are options.",
    path: ["minChoices"],
  });

/**
 * Options arrive as one JSON string rather than parallel `optionLabel[]` /
 * `optionPrice[]` arrays. Parallel arrays have to be zipped back together
 * by position, and anything that stops a field submitting (a disabled
 * input, say) silently shifts every later row onto the wrong record — a
 * bug we already had once in the opening-hours form.
 */
function readOptionGroupForm(formData: FormData) {
  let options: unknown = [];
  try {
    options = JSON.parse(String(formData.get("options") ?? "[]"));
  } catch {
    options = [];
  }

  return optionGroupSchema.safeParse({
    label: formData.get("label"),
    labelEn: formData.get("labelEn") ?? "",
    minChoices: formData.get("minChoices") ?? 0,
    maxChoices: formData.get("maxChoices") ?? 1,
    options,
  });
}

/** Stable, readable option ids, unique inside their group. */
function withOptionIds(options: { label: string; labelEn: string; price: number }[]) {
  const taken: string[] = [];
  return options.map((o) => {
    const base = slugify(o.label) || "option";
    let id = base;
    let n = 2;
    while (taken.includes(id)) id = `${base}-${n++}`;
    taken.push(id);
    return { id, label: o.label, labelEn: o.labelEn, price: o.price };
  });
}

export async function createOptionGroupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const parsed = readOptionGroupForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const group = await createOptionGroup({
    ...parsed.data,
    options: withOptionIds(parsed.data.options),
  });
  refreshMenu();
  redirect(flashRedirect("/admin/menu/extras", `“${group.label}” added.`));
}

export async function updateOptionGroupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  const parsed = readOptionGroupForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const group = await updateOptionGroup(id, {
    ...parsed.data,
    options: withOptionIds(parsed.data.options),
  });
  refreshMenu();
  redirect(flashRedirect("/admin/menu/extras", `“${group.label}” saved.`));
}

export async function deleteOptionGroupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  await deleteOptionGroup(id);
  refreshMenu();
  return { ok: true, message: "Extras group deleted." };
}
