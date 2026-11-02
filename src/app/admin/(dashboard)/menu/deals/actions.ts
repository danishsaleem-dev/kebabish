"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { createDeal, deleteDeal, listItems, moveDeal, updateDeal } from "@/lib/admin/store";
import type { StoredDeal } from "@/lib/admin/store/types";
import { flashRedirect } from "@/lib/admin/flash";
import { dealProblems } from "@/lib/deals";
import { isSellablePrice, toCents } from "@/lib/money";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/** Everything under /admin/menu/deals. Owner and staff: this sets what things sell for. */

function refresh() {
  revalidatePath("/admin/menu/deals");
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
  revalidatePath("/sitemap.xml");
}

const slotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  label: z.string().trim().max(60),
  labelEn: z.string().trim().max(60),
  quantity: z.number().int().min(1).max(20),
  itemSlugs: z.array(z.string().min(1)).min(1).max(12),
  removable: z.boolean(),
  removeCredit: z.number().min(0).max(1000),
});

const dealSchema = z.object({
  name: z.string().trim().min(2, "Give the deal a name.").max(80, "Keep the name under 80 characters."),
  nameEn: z.string().trim().max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(1500, "Keep the description under 1500 characters."),
  descriptionEn: z.string().trim().max(1500, "Keep the description under 1500 characters."),
  price: z.coerce.number("Enter the deal price.").min(0.5, "Enter the deal price.").max(1000),
  minItems: z.coerce.number().int().min(1, "At least one part must stay.").max(20),
  visible: z.boolean(),
  featured: z.boolean(),
  imageId: z.string().trim(),
});

/** The form, parsed and checked against the real menu. A string is what's wrong with it. */
async function readDealForm(
  formData: FormData
): Promise<{ deal: Omit<StoredDeal, "slug" | "createdAt"> } | { errors: Record<string, string>; message?: string }> {
  const parsed = dealSchema.safeParse({
    name: formData.get("name"),
    nameEn: formData.get("nameEn") ?? "",
    description: formData.get("description") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    price: formData.get("price"),
    minItems: formData.get("minItems"),
    visible: formData.get("visible") === "on",
    featured: formData.get("featured") === "on",
    imageId: formData.get("imageId") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors };
  }

  let rawSlots: unknown;
  try {
    rawSlots = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    rawSlots = null;
  }
  const slots = z.array(slotSchema).max(20).safeParse(rawSlots);
  if (!slots.success) return { errors: {}, message: "One of the parts isn't filled in properly." };

  const items = await listItems();
  const known = new Set(items.map((i) => i.slug));
  if (slots.data.some((s) => s.itemSlugs.some((slug) => !known.has(slug)))) {
    return { errors: {}, message: "One of those dishes isn't on the menu any more." };
  }

  const { imageId, ...fields } = parsed.data;
  const deal = {
    ...fields,
    ...(imageId ? { imageId } : { imageId: undefined }),
    // A fixed part can't carry a credit it will never use, and has no choice to name.
    slots: slots.data.map((s) => ({
      ...s,
      itemSlugs: [...new Set(s.itemSlugs)],
      removeCredit: s.removable ? s.removeCredit : 0,
    })),
  };

  const problems = dealProblems(
    { ...deal, slug: "", createdAt: "" },
    (slug) => {
      const price = items.find((i) => i.slug === slug)?.price;
      return isSellablePrice(price) ? toCents(price) : null;
    },
    (slug) => items.find((i) => i.slug === slug)?.name ?? slug
  );
  if (problems.errors.length > 0) return { errors: {}, message: problems.errors.join(" ") };
  return { deal };
}

export async function createDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const result = await readDealForm(formData);
  if (!("deal" in result)) return { ok: false, ...result };

  const deal = await createDeal(result.deal);
  refresh();
  redirect(flashRedirect("/admin/menu/deals", `“${deal.name}” created.`));
}

export async function updateDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const slug = String(formData.get("slug") ?? "");
  const result = await readDealForm(formData);
  if (!("deal" in result)) return { ok: false, ...result };

  const deal = await updateDeal(slug, result.deal);
  refresh();
  redirect(flashRedirect("/admin/menu/deals", `“${deal.name}” saved.`));
}

export async function deleteDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  await deleteDeal(String(formData.get("slug") ?? ""));
  refresh();
  return { ok: true, message: "Deal deleted." };
}

export async function toggleDealVisibilityAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);
  await updateDeal(String(formData.get("slug") ?? ""), { visible: formData.get("visible") === "true" });
  refresh();
}

export async function moveDealAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);
  await moveDeal(String(formData.get("slug") ?? ""), formData.get("direction") === "up" ? "up" : "down");
  refresh();
}
