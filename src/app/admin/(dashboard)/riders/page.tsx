import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import PrintButton from "@/components/admin/ui/PrintButton";
import RiderShiftTable from "@/components/admin/RiderShiftTable";
import { listRiders } from "@/lib/admin/auth-users";
import { listOrders } from "@/lib/admin/orders-data";
import {
  deliveriesOnDay,
  estimateForDeliveries,
  listShiftsBetween,
  todayKey,
  type RiderShift,
} from "@/lib/rider-shifts";
import { compareToEstimate, formatKm, type MileageEstimate } from "@/lib/rider-mileage";
import { amsterdamDateAhead } from "@/lib/delivery-slots";

export const metadata = { title: "Riders" };
export const dynamic = "force-dynamic";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

interface Row {
  shift: RiderShift;
  deliveries: number;
  estimate: MileageEstimate | null;
}

export default async function RidersPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.some((r) => String(r.days) === daysParam) ? Number(daysParam) : 30;

  const to = todayKey();
  const from = amsterdamDateAhead(-(days - 1)).dateKey;

  const [{ ready, shifts }, riders, orders] = await Promise.all([
    listShiftsBetween(from, to),
    listRiders(),
    listOrders(),
  ]);

  if (!ready) {
    return (
      <AdminShell title="Riders">
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <DatabaseZap size={22} />
          </span>
          <h2 className="font-display text-lg font-semibold text-heading">
            The rider mileage log isn&apos;t set up yet
          </h2>
          <p className="max-w-md text-sm text-muted">
            Run <code className="rounded bg-hairline px-1">supabase/migrations/0023_rider_shifts.sql</code>{" "}
            once in the Supabase SQL editor. Until then riders can&apos;t record their kilometres
            and nothing else changes.
          </p>
        </Card>
      </AdminShell>
    );
  }

  // The cross-check is built per rider per day from the orders they actually delivered.
  // `postcodeDistanceKm` caches by postcode, so a long range costs few lookups.
  const rows: Row[] = [];
  for (const shift of shifts) {
    const theirs = orders.filter((o) => o.assignedRiderId === shift.riderId);
    const delivered = deliveriesOnDay(theirs, shift.shiftDate);
    rows.push({
      shift,
      deliveries: delivered.length,
      estimate: await estimateForDeliveries(delivered).catch(() => null),
    });
  }

  const byRider = riders
    .map((rider) => {
      const theirs = rows.filter((r) => r.shift.riderId === rider.id);
      const km = theirs.reduce((total, r) => total + (r.shift.drivenKm ?? 0), 0);
      return {
        rider,
        rows: theirs,
        km,
        daysLogged: theirs.filter((r) => r.shift.drivenKm !== null).length,
        deliveries: theirs.reduce((total, r) => total + r.deliveries, 0),
      };
    })
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.km - a.km);

  // A shift whose rider has since been removed from the team still belongs in the figures.
  const orphaned = rows.filter((r) => !riders.some((rider) => rider.id === r.shift.riderId));
  const totalKm = rows.reduce((total, r) => total + (r.shift.drivenKm ?? 0), 0);
  const queries = rows.filter(
    (r) => compareToEstimate(r.shift.drivenKm, r.estimate) === "belowStraightLine"
  );

  return (
    <AdminShell title="Riders">
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader
            title="Kilometres driven"
            subtitle="What each rider read off their own dashboard at the start and the end of the round."
            action={<PrintButton label="Print" />}
          />

          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {RANGES.map((range) => (
              <Link
                key={range.days}
                href={`/admin/riders?days=${range.days}`}
                className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  range.days === days
                    ? "border-ember-600 bg-ember-600 text-cream-50"
                    : "border-hairline text-body-text hover:bg-canvas"
                }`}
              >
                {range.label}
              </Link>
            ))}
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Total" value={formatKm(totalKm)} />
            <Stat label="Rounds logged" value={String(rows.filter((r) => r.shift.drivenKm !== null).length)} />
            <Stat
              label="Worth a question"
              value={String(queries.length)}
              tone={queries.length > 0 ? "warn" : undefined}
            />
          </dl>

          <p className="mt-4 max-w-2xl text-xs text-muted">
            The estimate beside each round is a <strong>straight-line</strong> figure from the
            delivery addresses, kept only as a sanity check: the round can&apos;t have been
            shorter than &ldquo;at least&rdquo;, and real roads are longer than straight lines, so
            a sound reading normally sits comfortably above it. A round <em>below</em> that figure
            is flagged. Nothing here is a target or a rate of pay.
          </p>
        </Card>

        {byRider.length === 0 && orphaned.length === 0 ? (
          <Card className="py-10 text-center text-sm text-muted">
            No kilometres recorded in this period.
          </Card>
        ) : (
          <>
            {byRider.map((group) => (
              <Card key={group.rider.id} padded={false}>
                <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-heading">
                      {group.rider.name || group.rider.email}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {group.daysLogged} {group.daysLogged === 1 ? "round" : "rounds"} ·{" "}
                      {group.deliveries} {group.deliveries === 1 ? "delivery" : "deliveries"}
                    </p>
                  </div>
                  <p className="font-display text-2xl font-semibold tabular-nums text-heading">
                    {formatKm(group.km)}
                  </p>
                </div>
                <RiderShiftTable rows={group.rows} today={to} />
              </Card>
            ))}

            {orphaned.length > 0 && (
              <Card padded={false}>
                <div className="p-5 sm:p-6">
                  <h2 className="font-display text-lg font-semibold text-heading">
                    Riders no longer on the team
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Their rounds stay in the figures above and here.
                  </p>
                </div>
                <RiderShiftTable rows={orphaned} showRider today={to} />
              </Card>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`mt-1 font-display text-xl font-semibold tabular-nums ${
          tone === "warn" ? "text-warn" : "text-heading"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
