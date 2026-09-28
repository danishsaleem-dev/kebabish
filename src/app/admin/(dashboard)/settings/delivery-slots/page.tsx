import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeliverySlotRow from "@/components/admin/DeliverySlotRow";
import { getSettings } from "@/lib/admin/store";
import { listSlotConfigForDate } from "@/lib/delivery-slots-data";
import { amsterdamNow, nextOccurrenceOfWeekday } from "@/lib/delivery-slots";

export const metadata = { title: "Delivery slots" };
export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Displayed Mon->Sun (European week order) rather than the underlying
// 0=Sunday numbering, so Thu/Fri/Sat/Sun — Kebabish's actual open days —
// read left to right instead of Sunday jumping to the front.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function DeliverySlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ weekday?: string }>;
}) {
  const { weekday: weekdayParam } = await searchParams;
  const settings = await getSettings();
  const openWeekdays = WEEK_ORDER.filter(
    (d) => !settings.hours.find((h) => h.day === d)?.closed
  );

  const requested = weekdayParam ? Number(weekdayParam) : NaN;
  const now = amsterdamNow();
  const weekday = openWeekdays.includes(requested)
    ? requested
    : // Default to today if it's open, otherwise the next open day —
      // never a closed one, so there's always something to configure.
      (openWeekdays.find((d) => d === now.weekday) ?? openWeekdays[0]);

  // The config itself is recurring (every Thursday, say), but showing a
  // live "7/10" needs a real date to count against — the soonest real
  // occurrence of the weekday being viewed.
  const referenceDate = weekday === undefined ? now.dateKey : nextOccurrenceOfWeekday(weekday, now);

  const rows = weekday !== undefined ? await listSlotConfigForDate(referenceDate, weekday) : [];
  const noOpenDays = openWeekdays.length === 0;

  return (
    <AdminShell title="Delivery slots">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to settings
        </Link>

        <Card>
          <div className="flex items-start gap-3">
            <CalendarClock size={18} className="mt-0.5 shrink-0 text-ember-600" />
            <div className="min-w-0 flex-1">
              <CardHeader
                title="Delivery slots"
                subtitle="45-minute booking windows, generated from your opening hours (Settings). Capacity and on/off apply to every occurrence of that weekday's slot — set up the whole week regardless of what day it is today."
              />

              {noOpenDays ? (
                <p className="mt-4 text-sm text-muted">
                  No days are open in Settings yet — set your opening hours first.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {openWeekdays.map((d) => (
                      <Link
                        key={d}
                        href={`/admin/settings/delivery-slots?weekday=${d}`}
                        className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                          d === weekday
                            ? "border-ember-600 bg-ember-600 text-cream-50"
                            : "border-hairline bg-panel text-body-text hover:border-ember-500/40"
                        }`}
                      >
                        {WEEKDAY_LABELS[d]}
                      </Link>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Booked counts shown below are for{" "}
                    {new Date(`${referenceDate}T00:00:00`).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    , the next {WEEKDAY_LABELS[weekday]}.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        {!noOpenDays && (
          <Card padded={false}>
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">
                No 45-minute slots fit inside {WEEKDAY_LABELS[weekday]}&apos;s hours.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {rows.map((row) => (
                  <DeliverySlotRow key={row.start} weekday={weekday} row={row} />
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
