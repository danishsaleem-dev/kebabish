import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeliverySlotRow from "@/components/admin/DeliverySlotRow";
import { getSettings } from "@/lib/admin/store";
import { listSlotConfigForDate } from "@/lib/delivery-slots-data";
import { amsterdamNow, weekdayForDateKey } from "@/lib/delivery-slots";

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

export default async function DeliverySlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : amsterdamNow().dateKey;
  const weekday = weekdayForDateKey(dateKey);

  const [settings, rows] = await Promise.all([
    getSettings(),
    listSlotConfigForDate(dateKey, weekday),
  ]);

  const day = settings.hours.find((h) => h.day === weekday);
  const closedToday = !day || day.closed;

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
                subtitle="45-minute booking windows, generated from your opening hours (Settings). Capacity and on/off apply to every occurrence of that weekday's slot, not just the date you're viewing."
              />

              <form className="mt-4 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-heading">
                    Viewing
                  </span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={dateKey}
                    className="h-10 rounded-lg border border-hairline bg-panel px-3 text-sm text-heading focus:border-ember-500 focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="h-10 rounded-lg border border-hairline px-4 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
                >
                  View
                </button>
                <span className="pb-2.5 text-sm text-muted">
                  {WEEKDAY_LABELS[weekday]}
                </span>
              </form>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          {closedToday ? (
            <p className="p-6 text-center text-sm text-muted">
              The kitchen is closed on {WEEKDAY_LABELS[weekday]}s — no slots to configure.
            </p>
          ) : rows.length === 0 ? (
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
      </div>
    </AdminShell>
  );
}
