import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { postcodeDistanceKm } from "@/lib/delivery-area";
import { amsterdamNow } from "@/lib/delivery-slots";
import { estimateStraightLine, shiftKm, type MileageEstimate } from "@/lib/rider-mileage";
import type { AdminOrder } from "@/lib/admin/order-types";

/**
 * Reading and writing a rider's round: the two odometer readings, and the straight-line
 * cross-check built from the addresses they actually delivered to.
 *
 * Needs migration `0023_rider_shifts.sql`. Until it is run, every read here returns "not set
 * up" rather than throwing — the rider screen says so and the deliveries list below it still
 * works, which matters because the mileage log is a convenience and taking orders is not.
 * Only a *write* reports the missing table, the same rule the feedback and stock tables follow.
 */

const MISSING_TABLE = "42P01";

export interface RiderShift {
  id: string;
  riderId: string;
  riderName: string | null;
  /** "YYYY-MM-DD", the Amsterdam day the round belongs to. */
  shiftDate: string;
  startKm: number | null;
  startAt: string | null;
  endKm: number | null;
  endAt: string | null;
  note: string | null;
  /** end − start, or null until both readings are in. Never stored, always derived. */
  drivenKm: number | null;
}

interface ShiftRow {
  id: string;
  rider_id: string;
  shift_date: string;
  start_km: number | null;
  start_at: string | null;
  end_km: number | null;
  end_at: string | null;
  note: string | null;
  rider?: { name: string } | null;
}

const SHIFT_SELECT =
  "id, rider_id, shift_date, start_km, start_at, end_km, end_at, note, rider:admin_users!rider_shifts_rider_id_fkey(name)";

function toShift(row: ShiftRow): RiderShift {
  return {
    id: row.id,
    riderId: row.rider_id,
    riderName: row.rider?.name ?? null,
    shiftDate: row.shift_date,
    startKm: row.start_km,
    startAt: row.start_at,
    endKm: row.end_km,
    endAt: row.end_at,
    note: row.note,
    drivenKm: shiftKm(row.start_km, row.end_km),
  };
}

/** True when a Supabase error is only "that table doesn't exist yet". */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === MISSING_TABLE || /rider_shifts/.test(error.message ?? "");
}

function logMissing(where: string) {
  console.warn(`[rider-shifts] ${where}: run supabase/migrations/0023_rider_shifts.sql`);
}

/** Today's Amsterdam date key — the day a round belongs to. */
export function todayKey(): string {
  return amsterdamNow().dateKey;
}

/** One rider's round for one day, or null when they haven't started it. */
export async function getShift(
  riderId: string,
  shiftDate: string
): Promise<{ ready: boolean; shift: RiderShift | null }> {
  const { data, error } = await supabaseAdmin()
    .from("rider_shifts")
    .select(SHIFT_SELECT)
    .eq("rider_id", riderId)
    .eq("shift_date", shiftDate)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      logMissing("getShift");
      return { ready: false, shift: null };
    }
    throw new Error(error.message);
  }
  return { ready: true, shift: data ? toShift(data as unknown as ShiftRow) : null };
}

/** A rider's own recent rounds, newest first — their log on the rider screen. */
export async function listShiftsForRider(
  riderId: string,
  limit = 14
): Promise<{ ready: boolean; shifts: RiderShift[] }> {
  const { data, error } = await supabaseAdmin()
    .from("rider_shifts")
    .select(SHIFT_SELECT)
    .eq("rider_id", riderId)
    .order("shift_date", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) {
      logMissing("listShiftsForRider");
      return { ready: false, shifts: [] };
    }
    throw new Error(error.message);
  }
  return { ready: true, shifts: (data ?? []).map((r) => toShift(r as unknown as ShiftRow)) };
}

/** Every rider's rounds within a date range (inclusive), newest first — the admin screen. */
export async function listShiftsBetween(
  fromDate: string,
  toDate: string
): Promise<{ ready: boolean; shifts: RiderShift[] }> {
  const { data, error } = await supabaseAdmin()
    .from("rider_shifts")
    .select(SHIFT_SELECT)
    .gte("shift_date", fromDate)
    .lte("shift_date", toDate)
    .order("shift_date", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      logMissing("listShiftsBetween");
      return { ready: false, shifts: [] };
    }
    throw new Error(error.message);
  }
  return { ready: true, shifts: (data ?? []).map((r) => toShift(r as unknown as ShiftRow)) };
}

/**
 * Write one of the two readings. An upsert on (rider_id, shift_date), so pressing "start"
 * twice corrects the reading instead of opening a second round for the same day.
 *
 * The end reading is checked against the start one here *and* by a constraint in the table,
 * because a mistyped odometer is the most likely thing that will ever happen to this row.
 */
export async function saveShiftReading(input: {
  riderId: string;
  shiftDate: string;
  which: "start" | "end";
  km: number;
  note?: string | null;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; reason: "notSetUp" | "endBeforeStart" | "noStart" | "failed" }> {
  const { ready, shift } = await getShift(input.riderId, input.shiftDate).catch(() => ({
    ready: false as const,
    shift: null,
  }));
  if (!ready) return { ok: false, reason: "notSetUp" };

  if (input.which === "end") {
    // Ending a round that never started would record a difference against nothing.
    if (!shift || shift.startKm === null) return { ok: false, reason: "noStart" };
    if (input.km < shift.startKm) return { ok: false, reason: "endBeforeStart" };
  }
  // Correcting the start upwards past an end already recorded would make the round negative.
  if (input.which === "start" && shift?.endKm !== null && shift?.endKm !== undefined) {
    if (input.km > shift.endKm) return { ok: false, reason: "endBeforeStart" };
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    rider_id: input.riderId,
    shift_date: input.shiftDate,
    updated_by: input.actorId,
    updated_at: now,
  };
  if (input.which === "start") {
    row.start_km = input.km;
    // The time is stamped once, when the round is first opened: a correction to the reading
    // shouldn't rewrite when the rider says they set off.
    row.start_at = shift?.startAt ?? now;
  } else {
    row.end_km = input.km;
    row.end_at = shift?.endAt ?? now;
  }
  if (input.note !== undefined) row.note = input.note?.trim() ? input.note.trim() : null;

  const { error } = await supabaseAdmin()
    .from("rider_shifts")
    .upsert(row, { onConflict: "rider_id,shift_date" });

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "notSetUp" };
    console.error("[rider-shifts] save failed:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}

/**
 * The straight-line cross-check for a rider's day, built from the orders they actually
 * delivered. Each delivery's postcode is measured from the kitchen; see `rider-mileage.ts`
 * for what the two bounds mean and, more importantly, what they do not.
 *
 * Addresses that can't be located are counted, not silently dropped — an estimate built from
 * half a day's deliveries would understate the round and make a sound odometer reading look
 * suspicious.
 */
export async function estimateForDeliveries(orders: AdminOrder[]): Promise<MileageEstimate | null> {
  const distances: number[] = [];
  let unlocated = 0;

  for (const order of orders) {
    if (!order.postcode) {
      unlocated++;
      continue;
    }
    const km = await postcodeDistanceKm(order.postcode);
    if (km === null) unlocated++;
    else distances.push(km);
  }

  return estimateStraightLine(distances, unlocated);
}

/**
 * Which of a rider's orders count as "driven on this day". The delivery timestamp is what the
 * round actually consisted of; an order with none (it was marked delivered before that column
 * existed) falls back to the day it was booked for.
 */
export function deliveriesOnDay(orders: AdminOrder[], dateKey: string): AdminOrder[] {
  return orders.filter((o) => {
    if (o.status !== "delivered") return false;
    const day = o.deliveredAt ? amsterdamNow(new Date(o.deliveredAt)).dateKey : o.deliveryDate;
    return day === dateKey;
  });
}
