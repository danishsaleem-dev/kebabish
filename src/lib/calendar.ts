/**
 * Month-grid maths for the calendars on the site — the checkout day picker and the admin's
 * report range. Pure and timezone-free: a calendar date is a label ("2026-10-25"), never an
 * instant, so nothing here goes through `Date.parse` or UTC. Build a `Date` from local parts
 * only, or a visitor an hour either side of Amsterdam sees the month shifted by a day.
 */

export interface CalendarCell {
  /** "YYYY-MM-DD". */
  dateKey: string;
  /** Day of the month, 1-31. */
  day: number;
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  inMonth: boolean;
}

/** "YYYY-MM-DD" from calendar parts. `month` is 1-12, like a person writes it. */
export function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A plain calendar date as a local `Date` — never parsed from a string. */
export function dateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The year/month a date key belongs to (month 1-12). */
export function monthOfKey(dateKey: string): { year: number; month: number } {
  const [year, month] = dateKey.split("-").map(Number);
  return { year, month };
}

/** Step a year/month pair, rolling over the year. */
export function addMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
}

/** Compare two year/month pairs: negative when a is earlier. */
export function compareMonths(
  a: { year: number; month: number },
  b: { year: number; month: number }
): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/**
 * The weeks of a month as a grid, **Monday first** (how a Dutch calendar reads) and padded with
 * the neighbouring months' days so every row holds seven cells. Always whole weeks, so the grid
 * never has a ragged edge; a month needs five rows, or six when it starts late.
 */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month - 1, 1);
  // getDay() is 0=Sunday; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  // Tail of the previous month.
  const prev = addMonths(year, month, -1);
  const daysInPrev = new Date(prev.year, prev.month, 0).getDate();
  for (let i = lead - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    cells.push({ dateKey: dateKeyOf(prev.year, prev.month, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateKey: dateKeyOf(year, month, day), day, inMonth: true });
  }

  // Head of the next month, up to a whole number of weeks.
  const next = addMonths(year, month, 1);
  let day = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: dateKeyOf(next.year, next.month, day), day, inMonth: false });
    day++;
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The seven weekday initials/short names, Monday first, in the visitor's language. */
export function weekdayHeadings(locale: string, style: "short" | "narrow" = "short"): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).replace(/\.$/, "")
  );
}

/** "oktober 2026" — the heading above a month grid. */
export function monthLabel(year: number, month: number, locale: string): string {
  const name = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}
