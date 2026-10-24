import { addMonths, dateFromKey, dateKeyOf, monthOfKey } from "@/lib/calendar";

/**
 * The date range a report covers, and the buckets it is drawn in. Pure and isomorphic — the
 * reports screen picks a range in the browser and recomputes everything from the order list it
 * was already given, so no click costs a round trip.
 *
 * A range is **two inclusive calendar date labels**, not instants: "2026-10-01" to "2026-10-07"
 * is seven days whoever is looking and whatever the server's timezone. Orders are placed on an
 * Amsterdam day (see `orderDayKey` in `reports.ts`), which is the kitchen's day, not the
 * visitor's.
 */

export type Granularity = "day" | "week" | "month";

export interface ReportRange {
  /** Inclusive "YYYY-MM-DD". */
  from: string;
  /** Inclusive "YYYY-MM-DD". */
  to: string;
}

export interface ReportBucket {
  key: string;
  label: string;
  /** Inclusive. */
  from: string;
  /** Inclusive. */
  to: string;
}

export type PresetId =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
];

/** Step a date key by whole days. Built from local parts, never parsed — see `calendar.ts`. */
export function addDaysKey(dateKey: string, days: number): string {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + days);
  return dateKeyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Days in the range, counting both ends. */
export function dayCount(range: ReportRange): number {
  const from = dateFromKey(range.from).getTime();
  const to = dateFromKey(range.to).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

/** Put a range the right way round, so dragging a calendar backwards still works. */
export function normaliseRange(from: string, to: string): ReportRange {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function presetRange(id: PresetId, today: string): ReportRange {
  const { year, month } = monthOfKey(today);
  switch (id) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const d = addDaysKey(today, -1);
      return { from: d, to: d };
    }
    case "last7":
      return { from: addDaysKey(today, -6), to: today };
    case "last30":
      return { from: addDaysKey(today, -29), to: today };
    case "thisMonth":
      return { from: dateKeyOf(year, month, 1), to: today };
    case "lastMonth": {
      const prev = addMonths(year, month, -1);
      return { from: dateKeyOf(prev.year, prev.month, 1), to: addDaysKey(dateKeyOf(year, month, 1), -1) };
    }
    case "thisYear":
      return { from: dateKeyOf(year, 1, 1), to: today };
  }
}

/** Which preset a range happens to be, so the chips can show as selected. */
export function matchPreset(range: ReportRange, today: string): PresetId | null {
  for (const { id } of PRESETS) {
    const r = presetRange(id, today);
    if (r.from === range.from && r.to === range.to) return id;
  }
  return null;
}

/**
 * How finely to draw a range unless the reader says otherwise. A fortnight in days is
 * readable; a year in days is 365 bars nobody can tell apart.
 */
export function defaultGranularity(range: ReportRange): Granularity {
  const days = dayCount(range);
  if (days <= 31) return "day";
  if (days <= 182) return "week";
  return "month";
}

/** The granularities that make sense for a range — a single day has only itself. */
export function allowedGranularities(range: ReportRange): Granularity[] {
  const days = dayCount(range);
  const out: Granularity[] = ["day"];
  if (days >= 14) out.push("week");
  if (days >= 60) out.push("month");
  return out;
}

/**
 * The buckets a range is drawn in. Weeks start on Monday and months on the 1st, **clipped to
 * the range** at both ends: a part-week at the edge of the range is still a real bucket and is
 * labelled with the days it actually covers, so a total never includes days outside the range.
 */
export function bucketsFor(range: ReportRange, granularity: Granularity): ReportBucket[] {
  const buckets: ReportBucket[] = [];

  if (granularity === "day") {
    for (let key = range.from; key <= range.to; key = addDaysKey(key, 1)) {
      buckets.push({ key, label: dayLabel(key), from: key, to: key });
    }
    return buckets;
  }

  if (granularity === "week") {
    // Back up to the Monday on or before the range start, then clip.
    const firstDate = dateFromKey(range.from);
    const backTo = (firstDate.getDay() + 6) % 7;
    let weekStart = addDaysKey(range.from, -backTo);
    while (weekStart <= range.to) {
      const weekEnd = addDaysKey(weekStart, 6);
      const from = weekStart < range.from ? range.from : weekStart;
      const to = weekEnd > range.to ? range.to : weekEnd;
      buckets.push({ key: weekStart, label: spanLabel(from, to), from, to });
      weekStart = addDaysKey(weekStart, 7);
    }
    return buckets;
  }

  let { year, month } = monthOfKey(range.from);
  while (dateKeyOf(year, month, 1) <= range.to) {
    const monthStart = dateKeyOf(year, month, 1);
    const next = addMonths(year, month, 1);
    const monthEnd = addDaysKey(dateKeyOf(next.year, next.month, 1), -1);
    const from = monthStart < range.from ? range.from : monthStart;
    const to = monthEnd > range.to ? range.to : monthEnd;
    buckets.push({ key: monthStart, label: monthLabelShort(monthStart), from, to });
    ({ year, month } = next);
  }
  return buckets;
}

/**
 * The equally long range immediately before this one — what "vs previous" compares against.
 * Deliberately the same *number of days* rather than "the previous calendar month", so a
 * comparison is never between a 28-day month and a 31-day one.
 */
export function previousRange(range: ReportRange): ReportRange {
  const days = dayCount(range);
  const to = addDaysKey(range.from, -1);
  return { from: addDaysKey(to, -(days - 1)), to };
}

/** "25 Oct 2026" or "1 – 7 Oct 2026" — the heading above a report. */
export function describeRange(range: ReportRange): string {
  if (range.from === range.to) return fullLabel(range.from);
  return `${spanLabel(range.from, range.to)} ${dateFromKey(range.to).getFullYear()}`;
}

function dayLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fullLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthLabelShort(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** "1 – 7 Oct", or "28 Sep – 4 Oct" when the span crosses a month. */
function spanLabel(from: string, to: string): string {
  const a = dateFromKey(from);
  const b = dateFromKey(to);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = sameMonth
    ? String(a.getDate())
    : a.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const right = b.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${left} – ${right}`;
}
