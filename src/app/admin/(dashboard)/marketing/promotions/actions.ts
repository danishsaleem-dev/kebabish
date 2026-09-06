"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createPromoCode,
  deletePromoCode,
  updatePromoCode,
} from "@/lib/admin/store";
import { flashRedirect } from "@/lib/admin/flash";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/**
 * Server actions for /admin/marketing/promotions.
 *
 * Same shape as the menu actions (zod validation, `FormState` for inline
 * field errors, `flashRedirect` after a redirecting mutation) — see
 * menu/actions.ts for why.
 */

const promoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "At least 3 characters.")
      .max(30, "That's too long.")
      .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only."),
    type: z.enum(["percentage", "fixed"]),
    value: z.coerce.number().positive("Enter an amount greater than 0."),
    active: z.coerce.boolean(),
    minOrder: z.coerce.number().min(0).nullable(),
    expiresAt: z.string().nullable(),
    singleUsePerCustomer: z.coerce.boolean(),
  })
  .refine((v) => v.type !== "percentage" || v.value <= 100, {
    message: "A percentage discount can't exceed 100%.",
    path: ["value"],
  });

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

function readPromoForm(formData: FormData) {
  const minOrderRaw = String(formData.get("minOrder") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();

  return promoSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    active: formData.get("active") === "on",
    minOrder: minOrderRaw === "" ? null : minOrderRaw,
    expiresAt: expiresAtRaw === "" ? null : expiresAtRaw,
    singleUsePerCustomer: formData.get("singleUsePerCustomer") === "on",
  });
}

function refreshPromotions() {
  revalidatePath("/admin/marketing/promotions");
}

export async function createPromoCodeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = readPromoForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  let promo;
  try {
    promo = await createPromoCode(parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  refreshPromotions();
  redirect(
    flashRedirect("/admin/marketing/promotions", `“${promo.code}” created.`)
  );
}

export async function updatePromoCodeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = readPromoForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  let promo;
  try {
    promo = await updatePromoCode(id, parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  refreshPromotions();
  redirect(
    flashRedirect("/admin/marketing/promotions", `“${promo.code}” saved.`)
  );
}

export async function deletePromoCodeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  await deletePromoCode(id);
  refreshPromotions();
  return { ok: true, message: "Promo code deleted." };
}
