"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

/**
 * The opening-hours card on /contact: the week's hours, the live "open now"
 * pill, and today's row lit.
 *
 * "Now" lives in the browser on purpose. This page is statically generated, and
 * every regeneration of a public page is a metered Vercel ISR write — a page
 * whose output depended on the clock would have to regenerate every few
 * minutes just to keep a pill honest. Computed here, the page never changes
 * with the time, so it can sit on the same daily window as everything else.
 *
 * The server (and a crawler, and a visitor without JavaScript) gets the full
 * hours table and no pill / no "today" highlight; the browser adds them on
 * its first paint. The hours themselves are plain text in the HTML either way,
 * which is what search engines read. The rule is the one in `getStoreStatus`:
 * open now = taking orders AND inside today's window, in Amsterdam time.
 */

const TIME_ZONE = "Europe/Amsterdam";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface HoursRow {
  day: number; // 0 = Sunday
  opens: string; // "HH:MM"
  closes: string;
  closed: boolean;
}

interface Props {
  /** Already in the order to display (Monday first). */
  hours: HoursRow[];
  /** Day names indexed by `day` (0 = Sunday). */
  weekdays: string[];
  acceptingOrders: boolean;
  labels: { title: string; today: string; open: string; closedNow: string; closedDay: string };
}

/** "<weekday>|<minutes since midnight>" in Amsterdam; a primitive, so React can compare snapshots by value. */
function readNow(): string {
  const parts = FMT.formatToParts(new Date());
  const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return `${weekday}|${hour * 60 + minute}`;
}

/** Re-read once a minute so a pill left open on the page flips at opening time. */
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}

const serverSnapshot = () => null;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export default function LiveHours({ hours, weekdays, acceptingOrders, labels }: Props) {
  const now = useSyncExternalStore(subscribe, readNow, serverSnapshot);

  let today: number | null = null;
  let openNow: boolean | null = null;
  if (now) {
    const [d, mins] = now.split("|").map(Number);
    today = d;
    const row = hours.find((h) => h.day === d);
    openNow = Boolean(
      acceptingOrders && row && !row.closed && mins >= toMinutes(row.opens) && mins < toMinutes(row.closes)
    );
  }

  return (
    <section className="rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-charcoal-600">
          <Clock size={19} aria-hidden="true" className="text-ember-600" />
          {labels.title}
        </h2>
        {openNow !== null && (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              openNow ? "bg-success-soft text-success" : "bg-charcoal-600/10 text-charcoal-600/80"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${openNow ? "bg-success" : "bg-charcoal-400"}`} />
            {openNow ? labels.open : labels.closedNow}
          </span>
        )}
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        {hours.map((h) => {
          const isToday = h.day === today;
          return (
            <div
              key={h.day}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                isToday ? "bg-ember-600/10 font-semibold" : ""
              }`}
            >
              <dt className={isToday ? "text-charcoal-700" : "text-ink/60"}>
                {weekdays[h.day]}
                {isToday && (
                  <span className="ml-2 rounded-full bg-ember-600 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-cream-50">
                    {labels.today}
                  </span>
                )}
              </dt>
              <dd className={`tabular-nums ${h.closed ? "text-ink/45" : "font-medium text-charcoal-600"}`}>
                {h.closed ? labels.closedDay : `${h.opens} – ${h.closes}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
