"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { parseOdometer } from "@/lib/rider-mileage";
import { saveShiftReading, todayKey } from "@/lib/rider-shifts";

/**
 * Recording an odometer reading.
 *
 * A server action is a public POST endpoint, so this checks the session itself rather than
 * trusting the page that rendered the form. A rider may only ever write **their own** round:
 * the rider id is taken from the session and the form's value is ignored, so there is nothing
 * to forge. Owner and staff may correct someone else's reading, which is why the id is a
 * parameter at all.
 */

export interface MileageResult {
  ok: boolean;
  message: string;
}

const MESSAGES: Record<string, string> = {
  notSetUp: "The mileage log isn't set up yet — ask the office to run migration 0023.",
  endBeforeStart: "The end reading can't be lower than the start reading. Check the number.",
  noStart: "Record the reading you started with first.",
  failed: "Couldn't save that. Try again.",
};

export async function saveMileageAction(formData: FormData): Promise<MileageResult> {
  const session = await auth();
  if (!session) return { ok: false, message: "Sign in again." };
  const actor = session.user;

  const which = formData.get("which") === "end" ? "end" : "start";
  const km = parseOdometer(formData.get("km"));
  if (km === null) {
    return { ok: false, message: "Enter the kilometres shown on the dashboard." };
  }

  // Whose round this is: a rider's own, always. Only the office can touch another's.
  const requestedRider = String(formData.get("riderId") ?? "").trim();
  let riderId = actor.id;
  if (requestedRider && requestedRider !== actor.id) {
    if (actor.role !== "owner" && actor.role !== "staff") {
      return { ok: false, message: "You can only record your own kilometres." };
    }
    riderId = requestedRider;
  }
  if (actor.role === "manager" || actor.role === "kitchen") {
    return { ok: false, message: "You can only record your own kilometres." };
  }

  const shiftDate = dateOrToday(formData.get("shiftDate"));
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw.slice(0, 500) : undefined;

  const result = await saveShiftReading({ riderId, shiftDate, which, km, note, actorId: actor.id });
  if (!result.ok) return { ok: false, message: MESSAGES[result.reason] ?? MESSAGES.failed };

  revalidatePath("/rider");
  revalidatePath("/admin/riders");
  return {
    ok: true,
    message: which === "start" ? "Start reading saved." : "End reading saved — have a good evening.",
  };
}

/**
 * The day a reading belongs to. Anything that isn't a plain date, or is in the future, becomes
 * today: a round can be written up late, never in advance.
 */
function dateOrToday(value: FormDataEntryValue | null): string {
  const today = todayKey();
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  return value > today ? today : value;
}
