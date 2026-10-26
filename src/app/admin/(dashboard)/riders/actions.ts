"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { amsterdamLocalToUtc, amsterdamNow } from "@/lib/delivery-slots";
import { deleteShift, updateShiftAdmin } from "@/lib/rider-shifts";

/**
 * Correcting and deleting riders' rounds from /admin/riders. Owner/staff only, checked here
 * as well as on the page: a server action is a public POST endpoint.
 */

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ShiftEditInput {
  id: string;
  shiftDate: string;
  startKm: string;
  endKm: string;
  /** "HH:MM", Amsterdam time on `shiftDate`; blank = no time recorded. */
  startTime: string;
  endTime: string;
  note: string;
}

function reading(value: string): number | null | "bad" {
  const v = value.trim().replace(/[.\s]/g, "");
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return "bad";
  const n = Number(v);
  return n <= 1_000_000 ? n : "bad";
}

export async function updateShiftAction(input: ShiftEditInput): Promise<{ ok: boolean; message: string }> {
  const session = await requireRole(OWNER_STAFF);

  if (!UUID.test(input?.id ?? "")) return { ok: false, message: "Unknown round." };
  if (!DATE.test(input.shiftDate ?? "")) return { ok: false, message: "Pick the day of the round." };
  if (input.shiftDate > amsterdamNow().dateKey) {
    return { ok: false, message: "A round can't be on a day that hasn't happened yet." };
  }

  const startKm = reading(input.startKm ?? "");
  const endKm = reading(input.endKm ?? "");
  if (startKm === "bad" || endKm === "bad") {
    return { ok: false, message: "Readings are whole kilometres, up to 1,000,000." };
  }

  for (const t of [input.startTime, input.endTime]) {
    if (t && !TIME.test(t)) return { ok: false, message: "Times are written like 17:30." };
  }
  const startAt = input.startTime ? amsterdamLocalToUtc(input.shiftDate, input.startTime) : null;
  let endAt = input.endTime ? amsterdamLocalToUtc(input.shiftDate, input.endTime) : null;
  // A round that ends after midnight: an end time "before" the start belongs to the next day.
  if (startAt && endAt && endAt < startAt) endAt = new Date(endAt.getTime() + 86_400_000);

  const result = await updateShiftAdmin({
    id: input.id,
    shiftDate: input.shiftDate,
    startKm,
    endKm,
    startAt: startAt?.toISOString() ?? null,
    endAt: endAt?.toISOString() ?? null,
    note: (input.note ?? "").slice(0, 500),
    actorId: session.user.id,
  });

  if (!result.ok) {
    const message = {
      notSetUp: "The mileage log isn't set up yet (migration 0023).",
      endBeforeStart: "The end reading can't be lower than the start reading.",
      duplicate: "This rider already has a round on that day — edit or delete that one instead.",
      missing: "That round no longer exists.",
      failed: "Couldn't save it — try again.",
    }[result.reason];
    return { ok: false, message };
  }

  revalidatePath("/admin/riders");
  revalidatePath("/admin/reports");
  revalidatePath("/rider");
  return { ok: true, message: "Round saved." };
}

export async function deleteShiftAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_STAFF);
  if (!UUID.test(id ?? "")) return { ok: false, message: "Unknown round." };

  const result = await deleteShift(id);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "notSetUp"
          ? "The mileage log isn't set up yet (migration 0023)."
          : result.reason === "failed"
            ? "Couldn't delete it — try again."
            : "That round was already deleted.",
    };
  }

  revalidatePath("/admin/riders");
  revalidatePath("/admin/reports");
  revalidatePath("/rider");
  return { ok: true, message: "Round deleted." };
}
