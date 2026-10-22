import type { StoredSettings } from "@/lib/admin/store/types";

/**
 * The week's opening hours, boiled down for people to read at a glance: closed days dropped, and
 * consecutive days with the same hours merged — Thu 16:00–23:59, Fri 16:00–23:59, Sat 14:00–23:59,
 * Sun 14:00–23:59 becomes two lines, "Do – Vr 16:00 – 23:59" and "Za – Zo 14:00 – 23:59". Pure; the
 * source is Settings → opening hours, so the homepage can never disagree with what checkout offers.
 */

export interface HoursGroup {
  /** Weekdays in the group, 0 = Sunday, in week order (Monday first). */
  days: number[];
  opens: string;
  closes: string;
}

export interface HoursSummary {
  groups: HoursGroup[];
  /** First and last open day (0 = Sunday), set only when every open day is one unbroken run ("Thursday to Sunday"). */
  span: { from: number; to: number } | null;
}

/** Monday first, Sunday last — how people think of a week here. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function summariseHours(hours: StoredSettings["hours"]): HoursSummary {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const groups: HoursGroup[] = [];
  const openPositions: number[] = [];
  let previousPosition = -2;

  WEEK_ORDER.forEach((day, position) => {
    const h = byDay.get(day);
    if (!h || h.closed) return;
    openPositions.push(position);

    const last = groups[groups.length - 1];
    if (last && previousPosition === position - 1 && last.opens === h.opens && last.closes === h.closes) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], opens: h.opens, closes: h.closes });
    }
    previousPosition = position;
  });

  const unbroken =
    openPositions.length > 0 &&
    openPositions[openPositions.length - 1] - openPositions[0] === openPositions.length - 1;

  return {
    groups,
    span: unbroken
      ? { from: WEEK_ORDER[openPositions[0]], to: WEEK_ORDER[openPositions[openPositions.length - 1]] }
      : null,
  };
}

/** "do", "Thu" — a weekday's name in the visitor's language; first letter capitalised unless asked not to. */
export function dayName(day: number, locale: string, style: "short" | "long", capitalise = true): string {
  const name = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" })
    .format(new Date(Date.UTC(2024, 0, 7 + day)))
    .replace(/\.$/, "");
  return capitalise ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}
