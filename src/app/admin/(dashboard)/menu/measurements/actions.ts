"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import { createMeasurement, deleteMeasurement, getMeasurement, updateMeasurement } from "@/lib/admin/store";
import type { StoredMeasurement } from "@/lib/admin/store/types";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/**
 * Server actions for /admin/menu/measurements. Each checks the role itself: the page guard
 * protects the page, not the POST endpoint behind a button.
 */

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    out[issue.path.join(".") || "form"] ??= issue.message;
  }
  return out;
}

function refresh() {
  revalidatePath("/admin/menu/measurements");
  revalidatePath("/admin/menu/ingredients");
}

const blank = (v: FormDataEntryValue | null) =>
  v === null || String(v).trim() === "" ? undefined : v;

const grams = (label: string) =>
  z
    .preprocess(
      (v) => (v === undefined ? undefined : Number(v)),
      z
        .number({ error: `${label} must be a number.` })
        .gt(0, `${label} must be more than 0.`)
        .max(1000, "That looks like a typo: a spoon never holds that much.")
    )
    .optional();

const schema = z.object({
  nameEn: z.string().trim().min(2, "Give the row a name.").max(80),
  nameUr: z.string().trim().max(80).optional(),
  ingredientId: z.string().trim().optional(),
  form: z.enum(["whole", "bulk", "liquid", "sticks"]).optional(),
  gramsPerTbsp: grams("Tablespoon grams"),
  gramsPerTsp: grams("Teaspoon grams"),
  note: z.string().trim().max(200).optional(),
});

function read(formData: FormData) {
  const parsed = schema.safeParse({
    nameEn: formData.get("nameEn"),
    nameUr: blank(formData.get("nameUr")),
    ingredientId: blank(formData.get("ingredientId")),
    form: blank(formData.get("form")),
    gramsPerTbsp: blank(formData.get("gramsPerTbsp")),
    gramsPerTsp: blank(formData.get("gramsPerTsp")),
    note: blank(formData.get("note")),
  });
  if (!parsed.success) return parsed;
  const d = parsed.data;
  const row: Omit<StoredMeasurement, "id"> = {
    nameEn: d.nameEn,
    ...(d.nameUr ? { nameUr: d.nameUr } : {}),
    ...(d.ingredientId ? { ingredientId: d.ingredientId } : {}),
    ...(d.form ? { form: d.form } : {}),
    ...(d.gramsPerTbsp !== undefined ? { gramsPerTbsp: d.gramsPerTbsp } : {}),
    ...(d.gramsPerTsp !== undefined ? { gramsPerTsp: d.gramsPerTsp } : {}),
    ...(d.note ? { note: d.note } : {}),
  };
  return { success: true as const, data: row };
}

export async function createMeasurementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    await createMeasurement(parsed.data);
  } catch (error) {
    return { ok: false, errors: { ingredientId: error instanceof Error ? error.message : "Couldn't save." } };
  }
  refresh();
  redirect(flashRedirect("/admin/menu/measurements", `“${parsed.data.nameEn}” added.`));
}

export async function updateMeasurementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  if (!(await getMeasurement(id))) return { ok: false, message: "That row no longer exists." };
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    await updateMeasurement(id, parsed.data);
  } catch (error) {
    return { ok: false, errors: { ingredientId: error instanceof Error ? error.message : "Couldn't save." } };
  }
  refresh();
  redirect(flashRedirect("/admin/menu/measurements", `“${parsed.data.nameEn}” saved.`));
}

export async function deleteMeasurementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  await deleteMeasurement(String(formData.get("id") ?? ""));
  refresh();
  redirect(flashRedirect("/admin/menu/measurements", "Measurement deleted."));
}
