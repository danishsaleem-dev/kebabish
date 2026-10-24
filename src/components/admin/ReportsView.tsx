"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import TrendBadge from "@/components/admin/ui/TrendBadge";
import LineChart from "@/components/admin/charts/LineChart";
import DonutChart from "@/components/admin/charts/DonutChart";
import { ColumnChart, HorizontalBars } from "@/components/admin/charts/BarChart";
import DateRangePicker from "@/components/admin/reports/DateRangePicker";
import ReportSection, { ReportTable } from "@/components/admin/reports/ReportSection";
import { formatMoney } from "@/lib/admin/units";
import { downloadCsv, stampedFilename, toCsv } from "@/lib/admin/export";
import {
  allowedGranularities,
  bucketsFor,
  defaultGranularity,
  describeRange,
  presetRange,
  previousRange,
  type Granularity,
  type ReportRange,
} from "@/lib/admin/report-range";
import {
  byCategory,
  byChannel,
  byCustomer,
  byDish,
  byHour,
  byRider,
  byTown,
  byWeekday,
  delta,
  ordersInRange,
  seriesFor,
  summarise,
  type SeriesMetric,
} from "@/lib/admin/reports";
import type { AdminOrder } from "@/lib/admin/order-types";
import type { RiderShift } from "@/lib/rider-shifts";

const CATEGORY_COLORS = ["#a95026", "#c9713e", "#3d3831", "#12b76a", "#f79009", "#98a2b3"];

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "By day",
  week: "By week",
  month: "By month",
};

const METRIC_LABELS: Record<SeriesMetric, string> = {
  revenue: "Revenue",
  orders: "Orders",
  items: "Dishes sold",
};

/**
 * Reports. The whole order list, today's dish→category map, and the riders' logged rounds are
 * fetched once server-side and passed down; everything below is pure maths over those arrays,
 * so changing the range or the granularity costs no round trip.
 *
 * The range is a pair of **Amsterdam calendar days** the reader picks — presets or a calendar —
 * and *every* area on the page answers for exactly those days. Each area prints and exports on
 * its own (see `ReportSection`).
 */
export default function ReportsView({
  orders,
  categoryByDish,
  shifts,
  today,
}: {
  orders: AdminOrder[];
  categoryByDish: Map<string, string>;
  /** Rider odometer rounds; empty when migration 0023 hasn't been run. */
  shifts: RiderShift[];
  /** Today's Amsterdam date key, from the server, so the first paint matches. */
  today: string;
}) {
  const [range, setRange] = useState<ReportRange>(() => presetRange("last30", today));
  const [granularity, setGranularity] = useState<Granularity | "auto">("auto");
  const [metric, setMetric] = useState<SeriesMetric>("revenue");

  const allowed = allowedGranularities(range);
  const effective = granularity === "auto" || !allowed.includes(granularity)
    ? defaultGranularity(range)
    : granularity;

  const rangeLabel = describeRange(range);
  const inRange = useMemo(() => ordersInRange(orders, range), [orders, range]);
  const before = useMemo(() => ordersInRange(orders, previousRange(range)), [orders, range]);

  const now = useMemo(() => summarise(inRange), [inRange]);
  const then = useMemo(() => summarise(before), [before]);

  const buckets = useMemo(() => bucketsFor(range, effective), [range, effective]);
  const series = useMemo(() => seriesFor(inRange, buckets, metric), [inRange, buckets, metric]);

  const dishes = useMemo(() => byDish(inRange, categoryByDish), [inRange, categoryByDish]);
  const categories = useMemo(() => byCategory(inRange, categoryByDish), [inRange, categoryByDish]);
  const customers = useMemo(() => byCustomer(inRange), [inRange]);
  const riders = useMemo(() => byRider(orders, range, shifts), [orders, range, shifts]);
  const hours = useMemo(() => byHour(inRange), [inRange]);
  const weekdays = useMemo(() => byWeekday(inRange), [inRange]);
  const towns = useMemo(() => byTown(inRange), [inRange]);
  const channels = useMemo(() => byChannel(inRange), [inRange]);

  const busiest = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  const money = (n: number) => formatMoney(n);

  const headline = [
    { label: "Revenue", value: money(now.revenue), delta: delta(now.revenue, then.revenue) },
    { label: "Orders", value: now.orders.toLocaleString("en-GB"), delta: delta(now.orders, then.orders) },
    {
      label: "Average order",
      value: money(now.averageOrder),
      delta: delta(now.averageOrder, then.averageOrder),
    },
    {
      label: "Dishes sold",
      value: now.items.toLocaleString("en-GB"),
      delta: delta(now.items, then.items),
    },
    {
      label: "Customers",
      value: now.customers.toLocaleString("en-GB"),
      delta: delta(now.customers, then.customers),
    },
    {
      label: "Busiest hour",
      value: busiest && busiest.value > 0 ? busiest.label : "—",
    },
  ];

  const stamp = (name: string) => stampedFilename(`${name}-${range.from}-to-${range.to}`);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ---- the range, and what it covers ---- */}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-heading">{rangeLabel}</p>
            <p className="mt-0.5 text-xs text-muted">
              Compared with {describeRange(previousRange(range))}. Paid orders only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas print:hidden"
          >
            <Printer size={15} />
            Print everything
          </button>
        </div>

        <div className="border-b border-hairline px-5 py-4 sm:px-6">
          <DateRangePicker value={range} today={today} onChange={setRange} />
        </div>

        <div className="grid divide-y divide-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-3 lg:divide-y-0 xl:grid-cols-6">
          {headline.map((stat) => (
            <div key={stat.label} className="p-5">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-1.5 font-display text-xl font-semibold text-heading">
                {stat.value}
              </p>
              {stat.delta !== undefined && (
                <p className="mt-1.5 print:hidden">
                  <TrendBadge delta={stat.delta} />
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ---- the trend ---- */}
      <ReportSection
        title="Over time"
        subtitle={`${METRIC_LABELS[metric]}, ${GRANULARITY_LABELS[effective].toLowerCase()}`}
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("trend"),
            toCsv(
              buckets.map((b, i) => ({ ...b, value: series[i] })),
              [
                { header: "From", value: (r) => r.from },
                { header: "To", value: (r) => r.to },
                { header: "Period", value: (r) => r.label },
                { header: METRIC_LABELS[metric], value: (r) => r.value },
              ]
            )
          )
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <Dropdown
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={(Object.keys(METRIC_LABELS) as SeriesMetric[]).map((m) => ({
              value: m,
              label: METRIC_LABELS[m],
            }))}
          />
          <Dropdown
            label="Grouped"
            value={effective}
            onChange={(g: Granularity) => setGranularity(g)}
            options={allowed.map((g) => ({ value: g, label: GRANULARITY_LABELS[g] }))}
          />
        </div>

        {buckets.length === 1 ? (
          // One bucket is a number, not a line — a single point draws nothing readable.
          <p className="py-8 text-center">
            <span className="block font-display text-3xl font-semibold text-heading">
              {metric === "revenue" ? money(series[0]) : series[0].toLocaleString("en-GB")}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {METRIC_LABELS[metric]} on {rangeLabel}
            </span>
          </p>
        ) : (
          <LineChart
            labels={buckets.map((b) => b.label)}
            series={[
              { label: METRIC_LABELS[metric], values: series, color: "#a95026" },
            ]}
            valueFormat={(v) =>
              metric === "revenue"
                ? v >= 1000
                  ? `${Math.round(v / 1000)}k`
                  : `€${Math.round(v)}`
                : Math.round(v).toLocaleString("en-GB")
            }
          />
        )}
      </ReportSection>

      {/* ---- dishes ---- */}
      <ReportSection
        title="Dishes"
        subtitle="Every dish sold in this period, most portions first"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("dishes"),
            toCsv(dishes, [
              { header: "Dish", value: (r) => r.name },
              { header: "Category", value: (r) => r.category },
              { header: "Portions", value: (r) => r.quantity },
              { header: "Orders", value: (r) => r.orders },
              { header: "Revenue", value: (r) => r.revenue.toFixed(2) },
            ])
          )
        }
      >
        <ReportTable
          rows={dishes}
          keyOf={(r) => r.slug}
          limit={15}
          empty="No dishes sold in this period."
          columns={[
            { header: "Dish", cell: (r) => <span className="font-medium text-heading">{r.name}</span> },
            { header: "Category", cell: (r) => r.category, muted: true },
            { header: "Portions", cell: (r) => r.quantity, align: "right" },
            { header: "Orders", cell: (r) => r.orders, align: "right", muted: true },
            { header: "Revenue", cell: (r) => money(r.revenue), align: "right" },
          ]}
        />
      </ReportSection>

      {/* ---- categories ---- */}
      <ReportSection
        title="Categories"
        subtitle="Share of the period's dish revenue"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("categories"),
            toCsv(categories, [
              { header: "Category", value: (r) => r.label },
              { header: "Portions", value: (r) => r.quantity },
              { header: "Revenue", value: (r) => r.revenue.toFixed(2) },
              { header: "Share %", value: (r) => r.share },
            ])
          )
        }
      >
        {categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No sales in this period.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <DonutChart
              centreLabel="100%"
              slices={categories.map((c, i) => ({
                label: c.label,
                value: c.share,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }))}
            />
            <ReportTable
              rows={categories}
              keyOf={(r) => r.label}
              columns={[
                { header: "Category", cell: (r) => <span className="font-medium text-heading">{r.label}</span> },
                { header: "Portions", cell: (r) => r.quantity, align: "right" },
                { header: "Revenue", cell: (r) => money(r.revenue), align: "right" },
                { header: "Share", cell: (r) => `${r.share}%`, align: "right", muted: true },
              ]}
            />
          </div>
        )}
      </ReportSection>

      {/* ---- customers ---- */}
      <ReportSection
        title="Customers"
        subtitle="Who ordered in this period, by what they spent"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("customers"),
            toCsv(customers, [
              { header: "Customer", value: (r) => r.name },
              { header: "Contact", value: (r) => r.contact },
              { header: "Account", value: (r) => (r.registered ? "Registered" : "Guest") },
              { header: "Orders", value: (r) => r.orders },
              { header: "Dishes", value: (r) => r.items },
              { header: "Spent", value: (r) => r.revenue.toFixed(2) },
              { header: "Last order", value: (r) => r.lastOrder },
            ])
          )
        }
      >
        <ReportTable
          rows={customers}
          keyOf={(r, i) => `${r.contact}-${i}`}
          limit={15}
          empty="Nobody ordered in this period."
          columns={[
            {
              header: "Customer",
              cell: (r) => (
                <>
                  <span className="font-medium text-heading">{r.name}</span>
                  <span className="block text-xs text-muted">{r.contact}</span>
                </>
              ),
            },
            {
              header: "Account",
              cell: (r) => (r.registered ? "Registered" : "Guest"),
              muted: true,
            },
            { header: "Orders", cell: (r) => r.orders, align: "right" },
            { header: "Dishes", cell: (r) => r.items, align: "right", muted: true },
            { header: "Spent", cell: (r) => money(r.revenue), align: "right" },
          ]}
        />
      </ReportSection>

      {/* ---- riders ---- */}
      <ReportSection
        title="Riders"
        subtitle="Deliveries made in this period, and the kilometres they logged"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("riders"),
            toCsv(riders, [
              { header: "Rider", value: (r) => r.name },
              { header: "Deliveries", value: (r) => r.deliveries },
              { header: "Order value", value: (r) => r.revenue.toFixed(2) },
              { header: "Rounds logged", value: (r) => r.rounds },
              { header: "Kilometres", value: (r) => (r.km === null ? "" : r.km) },
            ])
          )
        }
      >
        <ReportTable
          rows={riders}
          keyOf={(r) => r.riderId ?? "unassigned"}
          empty="No deliveries in this period."
          columns={[
            { header: "Rider", cell: (r) => <span className="font-medium text-heading">{r.name}</span> },
            { header: "Deliveries", cell: (r) => r.deliveries, align: "right" },
            { header: "Order value", cell: (r) => money(r.revenue), align: "right", muted: true },
            { header: "Rounds", cell: (r) => r.rounds || "—", align: "right", muted: true },
            {
              header: "Kilometres",
              cell: (r) => (r.km === null ? "—" : `${r.km.toLocaleString("en-GB")} km`),
              align: "right",
            },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Kilometres are what the rider read off their own dashboard at each end of the round.
          A rider who hasn&apos;t logged any shows &ldquo;—&rdquo;, not zero. Order value is what
          those deliveries were worth, not anything owed to the rider.
        </p>
      </ReportSection>

      {/* ---- timing ---- */}
      <ReportSection
        title="Timing"
        subtitle="When the orders actually come in, Amsterdam time"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("timing"),
            toCsv(
              [
                ...hours.map((h) => ({ kind: "Hour", label: h.label, value: h.value })),
                ...weekdays.map((d) => ({ kind: "Weekday", label: d.label, value: d.value })),
              ],
              [
                { header: "Breakdown", value: (r) => r.kind },
                { header: "Period", value: (r) => r.label },
                { header: "Orders", value: (r) => r.value },
              ]
            )
          )
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              By hour
            </p>
            <ColumnChart data={hours} />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              By day of the week
            </p>
            <ColumnChart data={weekdays} color="#3d3831" />
          </div>
        </div>
      </ReportSection>

      {/* ---- where and how ---- */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <ReportSection
          title="Towns"
          subtitle="Where the deliveries went"
          rangeLabel={rangeLabel}
          onExport={() =>
            downloadCsv(
              stamp("towns"),
              toCsv(towns, [
                { header: "Town", value: (r) => r.label },
                { header: "Deliveries", value: (r) => r.value },
              ])
            )
          }
        >
          {towns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No deliveries in this period.</p>
          ) : (
            <HorizontalBars data={towns} color="#3d3831" />
          )}
        </ReportSection>

        <ReportSection
          title="Ordering channel"
          subtitle="Website checkout, WhatsApp, phone"
          rangeLabel={rangeLabel}
          onExport={() =>
            downloadCsv(
              stamp("channels"),
              toCsv(channels, [
                { header: "Channel", value: (r) => r.label },
                { header: "Orders", value: (r) => r.value },
              ])
            )
          }
        >
          {channels.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No orders in this period.</p>
          ) : (
            <HorizontalBars data={channels} />
          )}
        </ReportSection>
      </div>
    </div>
  );
}
