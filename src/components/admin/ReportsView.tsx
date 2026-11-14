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
import ReportSection, { ReportTable, type ReportView } from "@/components/admin/reports/ReportSection";
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
  byArea,
  byCategory,
  byChannel,
  byCustomer,
  byDish,
  byHour,
  byRider,
  byWeekday,
  customerMix,
  delta,
  ordersInRange,
  profitByCategory,
  profitByDish,
  profitSeries,
  profitTotals,
  seriesFor,
  summarise,
  type ProfitInputs,
  type SeriesMetric,
} from "@/lib/admin/reports";
import type { AdminOrder } from "@/lib/admin/order-types";
import type { RiderShift } from "@/lib/rider-shifts";
import { makeDayOf, type ClosedDay, type OpenDay } from "@/lib/business-day";
import type { StoredSupply } from "@/lib/admin/store/types";
import {
  SUPPLY_KIND_LABELS,
  packagingForOrders,
  perOrderCost,
  purchasesInRange,
  spendBySupply,
  totalSpendCents,
  type SupplyPurchase,
} from "@/lib/supplies";

const CATEGORY_COLORS = ["#a95026", "#c9713e", "#3d3831", "#12b76a", "#f79009", "#98a2b3"];

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "By day",
  week: "By week",
  month: "By month",
};

const METRIC_LABELS: Record<SeriesMetric, string> = {
  revenue: "Revenue",
  food: "Food sales",
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
  supplies,
  purchases,
  purchasesReady,
  costPerDish,
  vatRatePercent,
  today,
  closedDays,
  openDay,
}: {
  orders: AdminOrder[];
  categoryByDish: Map<string, string>;
  /** Rider odometer rounds; empty when migration 0023 hasn't been run. */
  shifts: RiderShift[];
  supplies: StoredSupply[];
  /** Logged supply purchases for the last year; empty when migration 0028 hasn't been run. */
  purchases: SupplyPurchase[];
  purchasesReady: boolean;
  /** Food cost of one portion by dish slug, from each dish's recipe. Absent = not costed. */
  costPerDish: Record<string, number>;
  /** VAT inside every price, from Settings → Tax. Null until the owner sets it. */
  vatRatePercent: number | null;
  /** The open business day's label (or today's date), from the server, so the first paint matches. */
  today: string;
  /** Closed business days, oldest first — empty until a day has been closed (or without 0027). */
  closedDays: ClosedDay[];
  /** Null when business days aren't set up: every order then keeps its calendar day. */
  openDay: OpenDay | null;
}) {
  // Every "which day is this order on" question goes through this one function, so a report
  // can never put an order on a different day than the close-the-day screen did.
  const dayOf = useMemo(
    () => (openDay ? makeDayOf(closedDays, openDay) : undefined),
    [closedDays, openDay]
  );
  const [range, setRange] = useState<ReportRange>(() => presetRange("last30", today));
  const [granularity, setGranularity] = useState<Granularity | "auto">("auto");
  const [metric, setMetric] = useState<SeriesMetric>("revenue");
  // The two areas that can be read either way. They start on the shape that answers
  // the question each is usually opened for: "how do the towns compare" is a table of
  // figures; "are people coming back" is a trend.
  const [areaView, setAreaView] = useState<ReportView>("table");
  const [mixView, setMixView] = useState<ReportView>("chart");
  const [profitView, setProfitView] = useState<ReportView>("chart");

  const allowed = allowedGranularities(range);
  const effective = granularity === "auto" || !allowed.includes(granularity)
    ? defaultGranularity(range)
    : granularity;

  const rangeLabel = describeRange(range);
  const inRange = useMemo(() => ordersInRange(orders, range, dayOf), [orders, range, dayOf]);
  const before = useMemo(
    () => ordersInRange(orders, previousRange(range), dayOf),
    [orders, range, dayOf]
  );

  const now = useMemo(() => summarise(inRange), [inRange]);
  const then = useMemo(() => summarise(before), [before]);

  const buckets = useMemo(() => bucketsFor(range, effective), [range, effective]);
  const series = useMemo(
    () => seriesFor(inRange, buckets, metric, dayOf),
    [inRange, buckets, metric, dayOf]
  );

  const dishes = useMemo(() => byDish(inRange, categoryByDish), [inRange, categoryByDish]);
  const categories = useMemo(() => byCategory(inRange, categoryByDish), [inRange, categoryByDish]);
  const customers = useMemo(() => byCustomer(inRange), [inRange]);
  const riders = useMemo(() => byRider(orders, range, shifts, dayOf), [orders, range, shifts, dayOf]);
  const hours = useMemo(() => byHour(inRange), [inRange]);
  const weekdays = useMemo(() => byWeekday(inRange, dayOf), [inRange, dayOf]);
  const areas = useMemo(() => byArea(inRange), [inRange]);
  // "First time or coming back" is judged against every order the shop ever took, so
  // this one gets the whole list as well as the range.
  const mix = useMemo(() => customerMix(orders, inRange, buckets, dayOf), [orders, inRange, buckets, dayOf]);
  const channels = useMemo(() => byChannel(inRange), [inRange]);

  // Supplies. Spend is what was actually bought in the range; packaging is each order's share
  // of the per-order supplies at *today's* prices (an order doesn't snapshot it).
  const packaging = useMemo(() => perOrderCost(supplies), [supplies]);
  const kindById = useMemo(() => new Map(supplies.map((s) => [s.id, s.kind])), [supplies]);
  const boughtInRange = useMemo(
    () => purchasesInRange(purchases, range.from, range.to),
    [purchases, range]
  );
  const spendRows = useMemo(() => spendBySupply(boughtInRange, kindById), [boughtInRange, kindById]);
  const spendEuros = totalSpendCents(boughtInRange) / 100;
  const packagingEuros = packagingForOrders(now.orders, packaging.total);

  // Profit. Everything it needs is data the owner already keeps — the recipes, the
  // per-order packaging from Supplies, and the VAT rate — so nothing here is a guess;
  // what isn't known is reported as not known (see `profitTotals`).
  const profitInputs: ProfitInputs = useMemo(
    () => ({ costPerDish, packagingPerOrder: packaging.total, vatRatePercent }),
    [costPerDish, packaging.total, vatRatePercent]
  );
  const profit = useMemo(() => profitTotals(inRange, profitInputs), [inRange, profitInputs]);
  const profitThen = useMemo(() => profitTotals(before, profitInputs), [before, profitInputs]);
  const profitOverTime = useMemo(
    () => profitSeries(inRange, buckets, profitInputs, dayOf),
    [inRange, buckets, profitInputs, dayOf]
  );
  const profitDishes = useMemo(
    () => profitByDish(inRange, categoryByDish, profitInputs),
    [inRange, categoryByDish, profitInputs]
  );
  const profitCategories = useMemo(() => profitByCategory(profitDishes), [profitDishes]);
  /** What the dishes themselves made — no delivery fees, no packaging. */
  const dishProfit = profitDishes.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  /** Nothing sold can be costed: print dashes, never a profit that is really just the sales. */
  const noCosts = profit.coveragePct === 0;

  const money = (n: number) => formatMoney(n);

  const headline = [
    { label: "Revenue", value: money(now.revenue), delta: delta(now.revenue, then.revenue) },
    {
      label: "Food sales",
      value: money(now.foodSales),
      delta: delta(now.foodSales, then.foodSales),
      hint: "After discounts and refunds",
    },
    {
      label: "Discounts given",
      value: money(now.discounts),
      hint:
        now.foodBeforeDiscounts > 0
          ? `${Math.round((now.discounts / now.foodBeforeDiscounts) * 100)}% of ${money(now.foodBeforeDiscounts)}`
          : undefined,
    },
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
      label: "Gross profit",
      value: noCosts ? "—" : money(profit.profit),
      hint: noCosts
        ? "No dish sold has a costed recipe yet"
        : `${profit.marginPct}% margin${profit.coveragePct < 100 ? ` · only ${profit.coveragePct}% costed` : ""}`,
      delta: noCosts ? undefined : delta(profit.profit, profitThen.profit),
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
              Compared with {describeRange(previousRange(range))}. Paid orders only
              {openDay && closedDays.length > 0
                ? ", by business day (from one closing to the next)."
                : "."}
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

        {/* gap-px over a hairline background draws the rules between tiles on every row count. */}
        <div className="grid gap-px overflow-hidden rounded-b-2xl bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {headline.map((stat) => (
            <div key={stat.label} className="bg-panel p-5">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-1.5 font-display text-xl font-semibold text-heading">
                {stat.value}
              </p>
              {stat.hint && <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>}
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
              {metric === "revenue" || metric === "food" ? money(series[0]) : series[0].toLocaleString("en-GB")}
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
              metric === "revenue" || metric === "food"
                ? v >= 1000
                  ? `${Math.round(v / 1000)}k`
                  : `€${Math.round(v)}`
                : Math.round(v).toLocaleString("en-GB")
            }
          />
        )}
      </ReportSection>

      {/* ---- profit ---- */}
      <ReportSection
        title="Profit"
        subtitle="What was taken, less the ingredients of what was cooked and the packaging it went out in"
        rangeLabel={rangeLabel}
        view={profitView}
        onView={setProfitView}
        onExport={() =>
          downloadCsv(
            stamp("profit"),
            toCsv(profitOverTime, [
              { header: "Period", value: (r) => r.label },
              { header: "Sales excl. VAT", value: (r) => r.sales.toFixed(2) },
              { header: "Food cost", value: (r) => r.foodCost.toFixed(2) },
              { header: "Packaging", value: (r) => r.packaging.toFixed(2) },
              { header: "Gross profit", value: (r) => r.profit.toFixed(2) },
              { header: "Margin %", value: (r) => r.marginPct },
            ])
          )
        }
      >
        {profit.orders === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No orders in this period.</p>
        ) : (
          <>
            {/* What the figure does and doesn't know, before the figure itself. */}
            {noCosts ? (
              <p className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
                No dish sold in this period has a costed recipe, so there is no profit to work out yet.
                Add a recipe under Menu → a dish → Recipe, and give its ingredients a price under Menu →
                Ingredients.
              </p>
            ) : (
              profit.coveragePct < 100 && (
                <p className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
                  <span className="font-semibold">Only {profit.coveragePct}% of the food sold can be costed.</span>{" "}
                  {profit.uncostedDishes} {profit.uncostedDishes === 1 ? "dish has" : "dishes have"} no costed
                  recipe ({money(profit.uncostedSales)} of sales, {profit.portionsUncosted} portions), so their
                  ingredients are missing and the profit below is higher than the real one.
                </p>
              )
            )}

            <div className="mb-5 grid gap-px overflow-hidden rounded-xl bg-hairline sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  label: "Sales",
                  value: money(profit.sales),
                  hint:
                    vatRatePercent && vatRatePercent > 0
                      ? `${money(profit.grossSales)} taken, less ${money(profit.vat)} VAT`
                      : "VAT not set, so nothing is taken off",
                },
                {
                  label: "Food cost",
                  value: noCosts ? "—" : money(profit.foodCost),
                  hint: noCosts ? "Nothing costed" : `${profit.portions - profit.portionsUncosted} portions costed`,
                },
                {
                  label: "Packaging",
                  value: money(profit.packaging),
                  hint:
                    packaging.total > 0
                      ? `${profit.orders} orders × ${money(packaging.total)}`
                      : "No per-order supply is costed yet",
                },
                {
                  label: "Gross profit",
                  value: noCosts ? "—" : money(profit.profit),
                  hint: noCosts ? "Needs costed recipes" : "Before wages, rent and fuel",
                },
                {
                  label: "Margin",
                  value: noCosts ? "—" : `${profit.marginPct}%`,
                  hint: noCosts ? undefined : "Of sales excl. VAT",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-panel p-4">
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold text-heading">{stat.value}</p>
                  {stat.hint && <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>}
                </div>
              ))}
            </div>

            {profitView === "chart" ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Sales, costs and profit over time
                  </p>
                  <LineChart
                    labels={profitOverTime.map((p) => p.label)}
                    series={[
                      { label: "Sales", values: profitOverTime.map((p) => p.sales), color: "#3d3831" },
                      {
                        label: "Costs",
                        values: profitOverTime.map((p) => p.foodCost + p.packaging),
                        color: "#f79009",
                        dashed: true,
                      },
                      { label: "Profit", values: profitOverTime.map((p) => p.profit), color: "#a95026" },
                    ]}
                    valueFormat={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `€${Math.round(v)}`)}
                  />
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Where the money went
                  </p>
                  <HorizontalBars
                    data={[
                      { label: "Food cost", value: profit.foodCost },
                      { label: "Packaging", value: profit.packaging },
                      ...(profit.vat > 0 ? [{ label: "VAT passed on", value: profit.vat }] : []),
                      ...(profit.profit > 0 ? [{ label: "Gross profit", value: profit.profit }] : []),
                    ]}
                    valueFormat={money}
                  />
                  {profit.profit <= 0 && !noCosts && (
                    <p className="mt-3 text-xs font-semibold text-danger">
                      Costs came to {money(Math.abs(profit.profit))} more than sales in this period.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ReportTable
                rows={profitOverTime}
                keyOf={(r, i) => `${r.label}-${i}`}
                empty="No orders in this period."
                columns={[
                  { header: "Period", cell: (r) => <span className="font-medium text-heading">{r.label}</span> },
                  { header: "Sales", cell: (r) => money(r.sales), align: "right" },
                  { header: "Food cost", cell: (r) => money(r.foodCost), align: "right", muted: true },
                  { header: "Packaging", cell: (r) => money(r.packaging), align: "right", muted: true },
                  { header: "Gross profit", cell: (r) => (noCosts ? "—" : money(r.profit)), align: "right" },
                  { header: "Margin", cell: (r) => (noCosts ? "—" : `${r.marginPct}%`), align: "right", muted: true },
                ]}
              />
            )}

            <p className="mt-4 text-xs leading-relaxed text-muted">
              Gross profit is sales{vatRatePercent && vatRatePercent > 0 ? " excluding VAT" : ""} less the
              ingredients of the portions cooked and the packaging those orders carried.{" "}
              <span className="font-semibold">
                Wages, rent, fuel, the payment provider&apos;s fee and everything else the kitchen pays are not
                in it
              </span>{" "}
              — nothing here records them. Ingredient prices are taken exactly as entered under Menu →
              Ingredients, and packaging at today&apos;s prices, so a past period moves if a price does. The
              full cost of a partly refunded order is still counted: the food was made.
            </p>
          </>
        )}
      </ReportSection>

      {/* ---- profit per dish ---- */}
      <ReportSection
        title="Profit by dish"
        subtitle="What each dish really earns, most profitable first. Packaging isn't here — it belongs to an order, not a dish."
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("profit-by-dish"),
            toCsv(profitDishes, [
              { header: "Dish", value: (r) => r.name },
              { header: "Category", value: (r) => r.category },
              { header: "Portions", value: (r) => r.portions },
              { header: "Sales excl. VAT", value: (r) => r.sales.toFixed(2) },
              { header: "Food cost", value: (r) => (r.cost === null ? "" : r.cost.toFixed(2)) },
              { header: "Profit", value: (r) => (r.profit === null ? "" : r.profit.toFixed(2)) },
              { header: "Margin %", value: (r) => r.marginPct ?? "" },
            ])
          )
        }
      >
        <ReportTable
          rows={profitDishes}
          keyOf={(r) => r.slug}
          limit={15}
          empty="No dishes sold in this period."
          columns={[
            { header: "Dish", cell: (r) => <span className="font-medium text-heading">{r.name}</span> },
            { header: "Category", cell: (r) => r.category, muted: true },
            { header: "Portions", cell: (r) => r.portions, align: "right", muted: true },
            { header: "Sales", cell: (r) => money(r.sales), align: "right" },
            {
              header: "Food cost",
              cell: (r) =>
                r.cost === null ? <span className="text-warn">no recipe</span> : money(r.cost),
              align: "right",
              muted: true,
            },
            { header: "Profit", cell: (r) => (r.profit === null ? "—" : money(r.profit)), align: "right" },
            {
              header: "Margin",
              cell: (r) => (r.marginPct === null ? "—" : `${r.marginPct}%`),
              align: "right",
              muted: true,
            },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          A dish reading “no recipe” has none, or its ingredients have no price — it is left out of the
          profit figures rather than counted as free. Sales are after discounts and refunds
          {vatRatePercent && vatRatePercent > 0 ? ", excluding VAT" : ""}.
        </p>
      </ReportSection>

      {/* ---- profit per category ---- */}
      <ReportSection
        title="Profit by category"
        subtitle="Which part of the menu earns the money. Dishes only — delivery fees and packaging belong to an order, not a category."
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("profit-by-category"),
            toCsv(profitCategories, [
              { header: "Category", value: (r) => r.label },
              { header: "Portions", value: (r) => r.portions },
              { header: "Sales excl. VAT", value: (r) => r.sales.toFixed(2) },
              { header: "Food cost", value: (r) => r.cost.toFixed(2) },
              { header: "Profit", value: (r) => r.profit.toFixed(2) },
              { header: "Margin %", value: (r) => r.marginPct },
              { header: "Share of profit %", value: (r) => r.share },
              { header: "Dishes costed", value: (r) => r.costed },
              { header: "Dishes with no recipe", value: (r) => r.uncosted },
            ])
          )
        }
      >
        {profitCategories.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No sales in this period.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="flex items-center justify-center">
              {/* The centre is the dish profit these slices add up to — not the section's gross
                  profit, which also carries the delivery fees and the packaging. */}
              <DonutChart
                centreLabel={noCosts ? "—" : money(dishProfit)}
                slices={profitCategories.map((c, i) => ({
                  label: c.label,
                  value: c.share,
                  color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                }))}
              />
            </div>
            <ReportTable
              rows={profitCategories}
              keyOf={(r) => r.label}
              columns={[
                { header: "Category", cell: (r) => <span className="font-medium text-heading">{r.label}</span> },
                { header: "Portions", cell: (r) => r.portions, align: "right", muted: true },
                { header: "Sales", cell: (r) => money(r.sales), align: "right", muted: true },
                // Nothing in the category is costed: that is unknown, not zero.
                { header: "Food cost", cell: (r) => (r.costed ? money(r.cost) : "—"), align: "right", muted: true },
                { header: "Profit", cell: (r) => (r.costed ? money(r.profit) : "—"), align: "right" },
                { header: "Margin", cell: (r) => (r.costed ? `${r.marginPct}%` : "—"), align: "right" },
                {
                  header: "No recipe",
                  cell: (r) => (r.uncosted > 0 ? <span className="text-warn">{r.uncosted}</span> : "—"),
                  align: "right",
                  muted: true,
                },
              ]}
            />
          </div>
        )}
      </ReportSection>

      {/* ---- dishes ---- */}
      <ReportSection
        title="Dishes"
        subtitle="Every dish sold in this period, most portions first. Sales are what was really charged, after each order's coupon or manual discount and any refund."
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("dishes"),
            toCsv(dishes, [
              { header: "Dish", value: (r) => r.name },
              { header: "Category", value: (r) => r.category },
              { header: "Portions", value: (r) => r.quantity },
              { header: "Orders", value: (r) => r.orders },
              { header: "Before discounts", value: (r) => r.grossRevenue.toFixed(2) },
              { header: "Sales after discounts", value: (r) => r.revenue.toFixed(2) },
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
            { header: "Before discounts", cell: (r) => money(r.grossRevenue), align: "right", muted: true },
            { header: "Sales", cell: (r) => money(r.revenue), align: "right" },
          ]}
        />
      </ReportSection>

      {/* ---- categories ---- */}
      <ReportSection
        title="Categories"
        subtitle="Share of the period's food sales, after discounts"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("categories"),
            toCsv(categories, [
              { header: "Category", value: (r) => r.label },
              { header: "Portions", value: (r) => r.quantity },
              { header: "Before discounts", value: (r) => r.grossRevenue.toFixed(2) },
              { header: "Sales after discounts", value: (r) => r.revenue.toFixed(2) },
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
                { header: "Sales", cell: (r) => money(r.revenue), align: "right" },
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

      {/* ---- supplies ---- */}
      <ReportSection
        title="Supplies"
        subtitle="What was spent on packaging and kitchen supplies, and the packaging each order carries"
        rangeLabel={rangeLabel}
        onExport={() =>
          downloadCsv(
            stamp("supplies"),
            toCsv(spendRows, [
              { header: "Supply", value: (r) => r.name },
              { header: "Kind", value: (r) => (r.kind ? SUPPLY_KIND_LABELS[r.kind] : "Deleted supply") },
              { header: "Purchases", value: (r) => r.purchases },
              { header: "Quantity", value: (r) => r.quantity },
              { header: "Spent", value: (r) => (r.amountCents / 100).toFixed(2) },
            ])
          )
        }
      >
        <div className="mb-5 grid gap-px overflow-hidden rounded-xl bg-hairline sm:grid-cols-3">
          {[
            {
              label: "Supplies bought",
              value: purchasesReady ? money(spendEuros) : "—",
              hint: purchasesReady
                ? `${boughtInRange.length} purchase${boughtInRange.length === 1 ? "" : "s"} logged`
                : "Purchases not set up yet",
            },
            {
              label: "Packaging on orders",
              value: money(packagingEuros),
              hint: `${now.orders.toLocaleString("en-GB")} orders × ${money(packaging.total)}`,
            },
            {
              label: "Packaging per order",
              value: money(packaging.total),
              hint: `${packaging.lines.length} per-order supplies counted`,
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-panel p-4">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-1 font-display text-xl font-semibold text-heading">{stat.value}</p>
              <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Bought in this period</p>
        <ReportTable
          rows={spendRows}
          keyOf={(r) => r.supplyId}
          empty={purchasesReady ? "No supplies were logged as bought in this period." : "Purchases aren't set up yet."}
          columns={[
            { header: "Supply", cell: (r) => <span className="font-medium text-heading">{r.name}</span> },
            { header: "Kind", cell: (r) => (r.kind ? SUPPLY_KIND_LABELS[r.kind] : "Deleted supply"), muted: true },
            { header: "Purchases", cell: (r) => r.purchases, align: "right", muted: true },
            { header: "Quantity", cell: (r) => r.quantity.toLocaleString("en-GB"), align: "right", muted: true },
            { header: "Spent", cell: (r) => money(r.amountCents / 100), align: "right" },
          ]}
        />

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Packaging in one order
        </p>
        <ReportTable
          rows={packaging.lines}
          keyOf={(r) => r.supplyId}
          empty="No per-order supply is counted yet. Set what each one uses per order under Menu → Supplies."
          columns={[
            { header: "Supply", cell: (r) => <span className="font-medium text-heading">{r.name}</span> },
            { header: "Per order", cell: (r) => `${r.perOrderQuantity} ${r.unit}`, align: "right", muted: true },
            { header: "Cost each", cell: (r) => `€ ${r.costPerUnit.toFixed(4)}`, align: "right", muted: true },
            { header: "Cost", cell: (r) => `€ ${r.cost.toFixed(4)}`, align: "right" },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Packaging is worked out at today&apos;s prices, so past periods change if a price does. It is
          not part of a dish&apos;s food cost.
          {packaging.incomplete.length > 0 &&
            ` ${packaging.incomplete.length} per-order supplies aren't counted yet (no "used per order" amount or no price).`}
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

      {/* ---- delivery areas ---- */}
      <ReportSection
        title="Delivery areas"
        subtitle="How each town performs, not just how many orders it sent. Pickup orders are left out — they didn't go anywhere."
        rangeLabel={rangeLabel}
        view={areaView}
        onView={setAreaView}
        onExport={() =>
          downloadCsv(
            stamp("delivery-areas"),
            toCsv(areas, [
              { header: "Town", value: (r) => r.town },
              { header: "Orders", value: (r) => r.orders },
              { header: "Customers", value: (r) => r.customers },
              { header: "Dishes", value: (r) => r.items },
              { header: "Food sales", value: (r) => r.foodSales.toFixed(2) },
              { header: "Revenue", value: (r) => r.revenue.toFixed(2) },
              { header: "Average order", value: (r) => r.averageOrder.toFixed(2) },
              { header: "Share %", value: (r) => r.share },
              { header: "Avg minutes to deliver", value: (r) => r.minutesToDeliver ?? "" },
            ])
          )
        }
      >
        {areas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No deliveries in this period.</p>
        ) : areaView === "chart" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Revenue</p>
              <HorizontalBars data={areas.map((a) => ({ label: a.town, value: a.revenue }))} valueFormat={money} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Orders</p>
              <HorizontalBars
                data={areas.map((a) => ({ label: a.town, value: a.orders }))}
                color="#3d3831"
                valueFormat={(v) => Math.round(v).toLocaleString("en-GB")}
              />
            </div>
          </div>
        ) : (
          <>
            <ReportTable
              rows={areas}
              keyOf={(r) => r.town}
              empty="No deliveries in this period."
              columns={[
                { header: "Town", cell: (r) => <span className="font-medium text-heading">{r.town}</span> },
                { header: "Orders", cell: (r) => r.orders, align: "right" },
                { header: "Customers", cell: (r) => r.customers, align: "right", muted: true },
                { header: "Dishes", cell: (r) => r.items, align: "right", muted: true },
                { header: "Food sales", cell: (r) => money(r.foodSales), align: "right", muted: true },
                { header: "Revenue", cell: (r) => money(r.revenue), align: "right" },
                { header: "Average order", cell: (r) => money(r.averageOrder), align: "right", muted: true },
                { header: "Share", cell: (r) => `${r.share}%`, align: "right", muted: true },
                {
                  header: "Avg delivery",
                  cell: (r) => (r.minutesToDeliver === null ? "—" : `${r.minutesToDeliver} min`),
                  align: "right",
                  muted: true,
                },
              ]}
            />
            <p className="mt-3 text-xs text-muted">
              Average delivery is from the order being placed to the rider marking it delivered — the whole
              wait, kitchen included. An order still on the road counts in the money and the orders, but not
              in that average.
            </p>
          </>
        )}
      </ReportSection>

      {/* ---- new and returning customers ---- */}
      <ReportSection
        title="Returning and new customers"
        subtitle="Whether an order came from someone ordering for the first time ever, or someone coming back"
        rangeLabel={rangeLabel}
        view={mixView}
        onView={setMixView}
        onExport={() =>
          downloadCsv(
            stamp("returning-and-new"),
            toCsv(mix.rows, [
              { header: "Period", value: (r) => r.label },
              { header: "New orders", value: (r) => r.newOrders },
              { header: "Returning orders", value: (r) => r.returningOrders },
              { header: "Orders", value: (r) => r.orders },
              { header: "Returning %", value: (r) => r.returningShare },
              { header: "Revenue from new", value: (r) => r.newRevenue.toFixed(2) },
              { header: "Revenue from returning", value: (r) => r.returningRevenue.toFixed(2) },
            ])
          )
        }
      >
        {mix.newOrders + mix.returningOrders === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No orders in this period.</p>
        ) : (
          <>
            <div className="mb-5 grid gap-px overflow-hidden rounded-xl bg-hairline sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "By returning customers",
                  value: `${mix.returningShare}%`,
                  hint: `${mix.returningOrders.toLocaleString("en-GB")} orders · ${money(mix.returningRevenue)}`,
                },
                {
                  label: "By new customers",
                  value: `${100 - mix.returningShare}%`,
                  hint: `${mix.newOrders.toLocaleString("en-GB")} orders · ${money(mix.newRevenue)}`,
                },
                {
                  label: "First-time customers",
                  value: mix.newCustomers.toLocaleString("en-GB"),
                  hint: "People whose first ever order is in this period",
                },
                {
                  label: "Returning customers",
                  value: mix.returningCustomers.toLocaleString("en-GB"),
                  hint: "People who had ordered before this period",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-panel p-4">
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold text-heading">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>
                </div>
              ))}
            </div>

            {mixView === "chart" ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <LineChart
                  labels={mix.rows.map((r) => r.label)}
                  series={[
                    {
                      label: "Returning",
                      values: mix.rows.map((r) => r.returningShare),
                      color: "#a95026",
                    },
                    {
                      label: "New",
                      values: mix.rows.map((r) => (r.orders ? 100 - r.returningShare : 0)),
                      color: "#3d3831",
                    },
                  ]}
                  valueFormat={(v) => `${Math.round(v)}%`}
                />
                <div className="flex items-center justify-center">
                  {/* The donut prints each slice's value with a % after it, so it is given
                      the shares — the order counts are on the tiles above. */}
                  <DonutChart
                    centreLabel={`${(mix.newOrders + mix.returningOrders).toLocaleString("en-GB")} orders`}
                    slices={[
                      { label: "Returning", value: mix.returningShare, color: "#a95026" },
                      { label: "New", value: 100 - mix.returningShare, color: "#3d3831" },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <ReportTable
                rows={mix.rows}
                keyOf={(r, i) => `${r.label}-${i}`}
                empty="No orders in this period."
                columns={[
                  { header: "Period", cell: (r) => <span className="font-medium text-heading">{r.label}</span> },
                  { header: "New", cell: (r) => r.newOrders, align: "right" },
                  { header: "Returning", cell: (r) => r.returningOrders, align: "right" },
                  { header: "Orders", cell: (r) => r.orders, align: "right", muted: true },
                  { header: "Returning %", cell: (r) => (r.orders ? `${r.returningShare}%` : "—"), align: "right" },
                  { header: "From new", cell: (r) => money(r.newRevenue), align: "right", muted: true },
                  { header: "From returning", cell: (r) => money(r.returningRevenue), align: "right", muted: true },
                ]}
              />
            )}
            <p className="mt-3 text-xs text-muted">
              An order counts as new only if it is that person&apos;s first ever — matched on their account,
              else email, else phone number, against every order the shop has taken, not only this period.
            </p>
          </>
        )}
      </ReportSection>

      {/* ---- how they ordered ---- */}
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
  );
}
