"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateSettings } from "@/lib/admin/store";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const settingsSchema = z.object({
  deliveryRadiusKm: z.coerce.number().min(1).max(50),
  deliveryFee: z.coerce.number().min(0).max(50),
  freeDeliveryOver: z
    .union([z.literal(""), z.coerce.number().min(0)])
    .transform((v) => (v === "" ? null : Number(v))),
  minimumOrder: z.coerce.number().min(0).max(200),
  averagePrepMinutes: z.coerce.number().int().min(5).max(180),
  acceptingOrders: z.boolean(),
  orderNotice: z.string().trim().max(200, "Keep the notice under 200 characters."),
});

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = settingsSchema.safeParse({
    deliveryRadiusKm: formData.get("deliveryRadiusKm"),
    deliveryFee: formData.get("deliveryFee"),
    freeDeliveryOver: formData.get("freeDeliveryOver") ?? "",
    minimumOrder: formData.get("minimumOrder"),
    averagePrepMinutes: formData.get("averagePrepMinutes"),
    acceptingOrders: formData.get("acceptingOrders") === "on",
    orderNotice: formData.get("orderNotice") ?? "",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  // Opening hours arrive as parallel arrays, one entry per weekday.
  const days = formData.getAll("hourDay").map(Number);
  const closed = formData.getAll("hourClosed").map((v) => v === "true");
  const opens = formData.getAll("hourOpens").map(String);
  const closes = formData.getAll("hourCloses").map(String);

  const hours = days.map((day, i) => ({
    day,
    closed: closed[i] ?? false,
    opens: TIME.test(opens[i]) ? opens[i] : "16:00",
    closes: TIME.test(closes[i]) ? closes[i] : "22:00",
  }));

  const badDay = hours.find(
    (h) => !h.closed && h.opens >= h.closes
  );
  if (badDay) {
    return {
      ok: false,
      message: "Closing time has to be after opening time on every open day.",
    };
  }

  await updateSettings({ ...parsed.data, hours });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ok: true, message: "Settings saved." };
}
