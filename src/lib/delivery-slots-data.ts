import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPublicSettings, getSettings } from "@/lib/admin/store";
import {
  DEFAULT_SLOT_CAPACITY,
  generateDaySlots,
  effectiveHours,
  isPastCutoff,
  amsterdamNow,
  type SlotAvailability,
  type SlotStatus,
} from "@/lib/delivery-slots";


interface SlotConfigRow {
  slot_start: string;
  max_orders: number;
  enabled: boolean;
}

interface BookingRow {
  slot_start: string;
  booked_count: number;
}

/**
 * Every slot for one date, with live capacity applied — what the checkout
 * page's slot picker polls. Customer-facing, so this deliberately exposes
 * only a status (available/full/disabled/past), never the raw booked/max
 * numbers — that detail is admin-only (see `listSlotConfigForDate` below).
 */
export async function getSlotAvailability(
  dateKey: string,
  weekday: number
): Promise<SlotAvailability[]> {
  const settings = await getPublicSettings();
  const day = effectiveHours(settings).find((h) => h.day === weekday);
  const windows = day ? generateDaySlots(day) : [];
  if (windows.length === 0) return [];

  const [{ data: configRows }, { data: bookingRows }] = await Promise.all([
    supabaseAdmin()
      .from("delivery_slot_config")
      .select("slot_start, max_orders, enabled")
      .eq("weekday", weekday),
    supabaseAdmin()
      .from("delivery_slot_bookings")
      .select("slot_start, booked_count")
      .eq("delivery_date", dateKey),
  ]);

  const configByStart = new Map(
    ((configRows ?? []) as SlotConfigRow[]).map((r) => [r.slot_start, r])
  );
  const bookedByStart = new Map(
    ((bookingRows ?? []) as BookingRow[]).map((r) => [r.slot_start, r.booked_count])
  );

  const now = amsterdamNow();

  return windows.map((window) => {
    const config = configByStart.get(window.start);
    // A limit set on this exact weekday+time wins; otherwise the day's own
    // (or the shop-wide) default.
    const maxOrders = config?.max_orders ?? day!.slotCapacity;
    const enabled = config?.enabled ?? true;
    const bookedCount = bookedByStart.get(window.start) ?? 0;

    let status: SlotStatus;
    if (isPastCutoff(dateKey, window.start, now, day!.slotMinutes)) status = "past";
    else if (!enabled) status = "disabled";
    else if (bookedCount >= maxOrders) status = "full";
    else status = "available";

    return { ...window, status, bookedCount, maxOrders };
  });
}

/**
 * The only place a slot is actually reserved — atomic in the database
 * (see reserve_delivery_slot() in the migration) so two customers racing
 * for the last spot can't both win. `weekday` is passed in rather than
 * derived from `dateKey` inside Postgres so it's guaranteed to agree with
 * the Amsterdam-local weekday the rest of this feature uses, not whatever
 * timezone the database session happens to be in.
 */
export async function reserveDeliverySlot(
  dateKey: string,
  weekday: number,
  slotStart: string
): Promise<boolean> {
  // What a slot with no limit of its own allows on this weekday — the day's
  // setting, else the shop-wide default. The database function can't read the
  // settings (they live in the JSON document), so it is told.
  const day = effectiveHours(await getSettings()).find((h) => h.day === weekday);
  const defaultMax = day?.slotCapacity ?? DEFAULT_SLOT_CAPACITY;

  const supabase = supabaseAdmin();
  let { data, error } = await supabase.rpc("reserve_delivery_slot", {
    p_date: dateKey,
    p_weekday: weekday,
    p_slot_start: slotStart,
    p_default_max: defaultMax,
  });

  // Migration 0013 adds the p_default_max version. Until it has been run, fall
  // back to the original function (which assumes 10) rather than breaking checkout.
  if (error && error.code === "PGRST202") {
    ({ data, error } = await supabase.rpc("reserve_delivery_slot", {
      p_date: dateKey,
      p_weekday: weekday,
      p_slot_start: slotStart,
    }));
  }

  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * The other half — called when a reserved order never happens (payment
 * failed/expired/cancelled, or staff cancelled it) so the seat goes back
 * into the pool. Best-effort: logged rather than thrown, since a failure
 * here would otherwise turn "release a slot" into "break a cancellation."
 */
export async function releaseDeliverySlot(
  dateKey: string | null,
  slotStart: string | null
): Promise<void> {
  if (!dateKey || !slotStart) return;
  const { error } = await supabaseAdmin().rpc("release_delivery_slot", {
    p_date: dateKey,
    p_slot_start: slotStart,
  });
  if (error) console.error("[delivery-slots] Failed to release a slot:", error);
}

export interface AdminSlotRow {
  start: string;
  end: string;
  maxOrders: number;
  enabled: boolean;
  bookedCount: number;
}

/**
 * The admin view: every slot for a weekday (derived from opening hours),
 * with the recurring config (max/enabled) and one specific date's live
 * booked count — unlike the customer-facing version, this carries the
 * real numbers ("7/10").
 */
export async function listSlotConfigForDate(
  dateKey: string,
  weekday: number
): Promise<AdminSlotRow[]> {
  const settings = await getSettings();
  const day = effectiveHours(settings).find((h) => h.day === weekday);
  const windows = day ? generateDaySlots(day) : [];
  if (windows.length === 0) return [];

  const [{ data: configRows, error: configError }, { data: bookingRows, error: bookingError }] =
    await Promise.all([
      supabaseAdmin()
        .from("delivery_slot_config")
        .select("slot_start, max_orders, enabled")
        .eq("weekday", weekday),
      supabaseAdmin()
        .from("delivery_slot_bookings")
        .select("slot_start, booked_count")
        .eq("delivery_date", dateKey),
    ]);

  if (configError) throw new Error(configError.message);
  if (bookingError) throw new Error(bookingError.message);

  const configByStart = new Map(
    ((configRows ?? []) as SlotConfigRow[]).map((r) => [r.slot_start, r])
  );
  const bookedByStart = new Map(
    ((bookingRows ?? []) as BookingRow[]).map((r) => [r.slot_start, r.booked_count])
  );

  return windows.map((window) => {
    const config = configByStart.get(window.start);
    return {
      ...window,
      maxOrders: config?.max_orders ?? day!.slotCapacity,
      enabled: config?.enabled ?? true,
      bookedCount: bookedByStart.get(window.start) ?? 0,
    };
  });
}

/** Owner/staff only (enforced by the action calling this) — upserts one slot's recurring config. */
export async function upsertSlotConfig(
  weekday: number,
  slotStart: string,
  patch: { maxOrders?: number; enabled?: boolean }
): Promise<void> {
  // A fresh row starts at the day's default capacity, not a hard-coded 10.
  const day = effectiveHours(await getSettings()).find((h) => h.day === weekday);
  const defaultMax = day?.slotCapacity ?? DEFAULT_SLOT_CAPACITY;

  const { data: existing } = await supabaseAdmin()
    .from("delivery_slot_config")
    .select("max_orders, enabled")
    .eq("weekday", weekday)
    .eq("slot_start", slotStart)
    .maybeSingle();

  const { error } = await supabaseAdmin()
    .from("delivery_slot_config")
    .upsert(
      {
        weekday,
        slot_start: slotStart,
        max_orders: patch.maxOrders ?? existing?.max_orders ?? defaultMax,
        enabled: patch.enabled ?? existing?.enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "weekday,slot_start" }
    );

  if (error) throw new Error(error.message);
}
