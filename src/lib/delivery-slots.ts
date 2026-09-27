import type { StoredSettings } from "@/lib/admin/store/types";

/**
 * Pure date/time maths for delivery slots — no Supabase, safe to import
 * from a Client Component. The data layer that actually reserves/reads
 * live capacity is `delivery-slots-data.ts` (server-only).
 */

export const SLOT_MINUTES = 45;
/** A slot stops taking bookings this many minutes before it starts. */
export const CUTOFF_MINUTES = 15;
/** How far ahead a customer can schedule — today plus this many days. */
export const BOOKING_WINDOW_DAYS = 7;

export interface SlotWindow {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

/** The weekday (0=Sunday) for a plain "YYYY-MM-DD" calendar date — timezone-independent, since a calendar date's weekday is a fixed fact. */
export function weekdayForDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Slices a day's opening hours into fixed 45-minute windows. A trailing
 * remainder shorter than a full slot (e.g. 10:00-23:00 is 780 minutes —
 * 17 full slots with 15 minutes left over) is dropped rather than offered
 * as a short slot.
 */
export function generateDaySlots(day: {
  closed: boolean;
  opens: string;
  closes: string;
}): SlotWindow[] {
  if (day.closed) return [];

  const opens = toMinutes(day.opens);
  const closes = toMinutes(day.closes);
  const slots: SlotWindow[] = [];

  for (let start = opens; start + SLOT_MINUTES <= closes; start += SLOT_MINUTES) {
    slots.push({ start: toHHMM(start), end: toHHMM(start + SLOT_MINUTES) });
  }

  return slots;
}

/** "YYYY-MM-DD", "HH:MM" and the 0=Sunday weekday, all in Europe/Amsterdam. */
export interface AmsterdamNow {
  dateKey: string;
  minutes: number;
  weekday: number;
}

const AMSTERDAM_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const AMSTERDAM_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const AMSTERDAM_WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Amsterdam",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Where "now" actually is in Amsterdam, regardless of the server/browser's own timezone. */
export function amsterdamNow(at: Date = new Date()): AmsterdamNow {
  // en-CA gives YYYY-MM-DD directly — the one built-in locale format that does.
  const dateKey = AMSTERDAM_DATE_FMT.format(at);
  const [h, m] = AMSTERDAM_TIME_FMT.format(at).split(":").map(Number);
  const weekday = WEEKDAYS.indexOf(AMSTERDAM_WEEKDAY_FMT.format(at));
  return { dateKey, minutes: h * 60 + m, weekday };
}

/** The weekday (0=Sunday) and "YYYY-MM-DD" for a date `daysAhead` from today, in Amsterdam. */
export function amsterdamDateAhead(daysAhead: number, from: Date = new Date()) {
  // Adding whole days in UTC and re-reading the Amsterdam calendar date
  // avoids DST-transition edge cases that naive local-time arithmetic hits.
  const shifted = new Date(from.getTime() + daysAhead * 86_400_000);
  const dateKey = AMSTERDAM_DATE_FMT.format(shifted);
  const weekday = WEEKDAYS.indexOf(AMSTERDAM_WEEKDAY_FMT.format(shifted));
  return { dateKey, weekday };
}

export type SlotStatus = "available" | "full" | "disabled" | "past";

export interface SlotAvailability extends SlotWindow {
  status: SlotStatus;
  bookedCount: number;
  maxOrders: number;
}

/**
 * Is this specific date+slot still bookable *time-wise* — i.e. not today's
 * slot within CUTOFF_MINUTES of starting, and not a past date entirely.
 * Doesn't know about capacity/enabled — that's layered on in
 * delivery-slots-data.ts, which is the only place that can see live counts.
 */
export function isPastCutoff(
  dateKey: string,
  slotStartHHMM: string,
  now: AmsterdamNow = amsterdamNow()
): boolean {
  if (dateKey < now.dateKey) return true;
  if (dateKey > now.dateKey) return false;
  return toMinutes(slotStartHHMM) - CUTOFF_MINUTES <= now.minutes;
}

/** Every hours-configured day within the booking window, for building a date picker. */
export function upcomingBookableDays(
  hours: StoredSettings["hours"],
  now: AmsterdamNow = amsterdamNow()
): { dateKey: string; weekday: number }[] {
  const byWeekday = new Map(hours.map((h) => [h.day, h]));
  const days: { dateKey: string; weekday: number }[] = [];

  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    const { dateKey, weekday } = amsterdamDateAhead(i);
    const day = byWeekday.get(weekday);
    if (day && !day.closed && generateDaySlots(day).length > 0) {
      days.push({ dateKey, weekday });
    }
  }

  return days;
}
