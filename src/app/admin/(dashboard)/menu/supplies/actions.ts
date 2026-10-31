"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import { createSupply, deleteSupply, getSupply, updateSupply } from "@/lib/admin/store";
import type { StoredSupply } from "@/lib/admin/store/types";
import { SUPPLY_UNITS } from "@/lib/supplies";
import { deletePurchase, insertPurchase } from "@/lib/supplies-data";
import { amsterdamNow } from "@/lib/delivery-slots";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/**
 * Server actions for /admin/menu/supplies. Like every admin action they check the role
 * themselves: the page guard protects the page, not the POST endpoint behind a button.
 */

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    out[issue.path.join(".") || "form"] ??= issue.message;
  }
  return out;
}

function refresh() {
  revalidatePath("/admin/menu/supplies");
  revalidatePath("/admin/menu/supplies/purchases");
  revalidatePath("/admin/reports");
}

const blank = (v: FormDataEntryValue | null) =>
  v === null || String(v).trim() === "" ? undefined : v;

const optionalNumber = (label: string, { gt = false }: { gt?: boolean } = {}) =>
  z
    .preprocess(
      (v) => (v === undefined ? undefined : Number(v)),
      z
        .number({ error: `${label} must be a number.` })
        .refine((n) => (gt ? n > 0 : n >= 0), gt ? `${label} must be more than 0.` : `${label} can't be negative.`)
        .refine((n) => n <= 10_000_000, "That looks like a typo.")
    )
    .optional();

const supplySchema = z.object({
  name: z.string().trim().min(2, "Give the supply a name."),
  supplier: z.string().trim().max(80).optional(),
  unit: z.enum(SUPPLY_UNITS),
  kind: z.enum(["per-order", "running"]),
  baseQuantity: optionalNumber("Quantity", { gt: true }),
  basePrice: optionalNumber("Price"),
  perOrderQuantity: optionalNumber("Per order", { gt: true }),
  note: z.string().trim().max(200).optional(),
});

function readSupply(formData: FormData) {
  const parsed = supplySchema.safeParse({
    name: formData.get("name"),
    supplier: blank(formData.get("supplier")),
    unit: formData.get("unit"),
    kind: formData.get("kind"),
    baseQuantity: blank(formData.get("baseQuantity")),
    basePrice: blank(formData.get("basePrice")),
    perOrderQuantity: blank(formData.get("perOrderQuantity")),
    note: blank(formData.get("note")),
  });
  if (!parsed.success) return parsed;
  const d = parsed.data;
  const supply: Omit<StoredSupply, "id"> = {
    name: d.name,
    unit: d.unit,
    kind: d.kind,
    ...(d.supplier ? { supplier: d.supplier } : {}),
    ...(d.baseQuantity !== undefined ? { baseQuantity: d.baseQuantity } : {}),
    ...(d.basePrice !== undefined ? { basePrice: d.basePrice } : {}),
    // Only a per-order supply has a "per order" amount; a running one never carries a stale one.
    ...(d.kind === "per-order" && d.perOrderQuantity !== undefined
      ? { perOrderQuantity: d.perOrderQuantity }
      : {}),
    ...(d.note ? { note: d.note } : {}),
  };
  return { success: true as const, data: supply };
}

export async function createSupplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const parsed = readSupply(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await createSupply(parsed.data);
  refresh();
  redirect(flashRedirect("/admin/menu/supplies", `“${parsed.data.name}” added.`));
}

export async function updateSupplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const id = String(formData.get("id") ?? "");
  if (!(await getSupply(id))) return { ok: false, message: "That supply no longer exists." };
  const parsed = readSupply(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await updateSupply(id, parsed.data);
  refresh();
  redirect(flashRedirect("/admin/menu/supplies", `“${parsed.data.name}” saved.`));
}

export async function deleteSupplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  await deleteSupply(String(formData.get("id") ?? ""));
  refresh();
  redirect(flashRedirect("/admin/menu/supplies", "Supply deleted. Past purchases are kept."));
}

/* ---------------------------------------------------------------- purchases */

const purchaseSchema = z.object({
  supplyId: z.string().min(1, "Choose what was bought."),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the day it was bought."),
  quantity: z.coerce.number({ error: "Enter how many." }).gt(0, "Quantity must be more than 0.").max(10_000_000),
  amount: z.coerce.number({ error: "Enter what you paid." }).min(0, "Amount can't be negative.").max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

export async function logPurchaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(OWNER_STAFF);
  const parsed = purchaseSchema.safeParse({
    supplyId: formData.get("supplyId"),
    purchasedOn: formData.get("purchasedOn"),
    quantity: formData.get("quantity"),
    amount: formData.get("amount"),
    note: blank(formData.get("note")),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const today = amsterdamNow().dateKey;
  if (d.purchasedOn > today) return { ok: false, errors: { purchasedOn: "That day hasn't happened yet." } };
  if (d.purchasedOn < "2024-01-01") return { ok: false, errors: { purchasedOn: "That date looks wrong." } };

  const supply = await getSupply(d.supplyId);
  if (!supply) return { ok: false, errors: { supplyId: "That supply no longer exists." } };

  try {
    await insertPurchase({
      supplyId: supply.id,
      supplyName: supply.name,
      purchasedOn: d.purchasedOn,
      quantity: d.quantity,
      amountCents: Math.round(d.amount * 100),
      note: d.note ?? null,
      createdBy: session.user.id ?? null,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Couldn't save the purchase." };
  }
  refresh();
  return { ok: true, message: `Logged ${supply.name}.` };
}

export async function deletePurchaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  try {
    await deletePurchase(String(formData.get("id") ?? ""));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Couldn't delete it." };
  }
  refresh();
  return { ok: true, message: "Purchase deleted." };
}
