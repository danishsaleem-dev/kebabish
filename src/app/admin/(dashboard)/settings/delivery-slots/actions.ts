"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { upsertSlotConfig } from "@/lib/delivery-slots-data";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/** Owner/staff only — edits the recurring weekday+time config, not just the viewed date. */
export async function updateSlotConfigAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff") {
    return { ok: false, message: "Sign in again to do that." };
  }

  const weekday = Number(formData.get("weekday"));
  const slotStart = String(formData.get("slotStart") ?? "");
  const field = formData.get("field");

  if (!slotStart || Number.isNaN(weekday)) {
    return { ok: false, message: "Something went wrong — try again." };
  }

  try {
    if (field === "maxOrders") {
      const maxOrders = Number(formData.get("maxOrders"));
      if (!Number.isFinite(maxOrders) || maxOrders < 1) {
        return { ok: false, message: "Capacity has to be at least 1." };
      }
      await upsertSlotConfig(weekday, slotStart, { maxOrders: Math.floor(maxOrders) });
    } else {
      await upsertSlotConfig(weekday, slotStart, {
        enabled: formData.get("enabled") === "true",
      });
    }
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/admin/settings/delivery-slots");
  return { ok: true };
}
