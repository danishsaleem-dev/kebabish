"use client";

import { useMemo, useState } from "react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import TrendBadge from "@/components/admin/ui/TrendBadge";
import LineChart from "@/components/admin/charts/LineChart";
import AreaChart from "@/components/admin/charts/AreaChart";
import DonutChart from "@/components/admin/charts/DonutChart";
import OrderActivities from "@/components/admin/OrderActivities";
import { formatMoneyShort } from "@/lib/admin/units";
import {
  getOrderAnalytics,
  getOrderPerformance,
  getRevenueProfile,
  getSummaryStats,
  orders,
  PERIOD_LABELS,
  STATUS_FILTER_LABELS,
  type Period,
  type StatusFilter,
} from "@/lib/admin/mock-data";

const TONE_COLOR = {
  success: "#12b76a",
  warn: "#f79009",
  danger: "#f04438",
} as const;

/**
 * Dashboard. Every dropdown here actually drives the data — changing the
 * period or status re-derives the series from mock-data and the charts tween
 * into the new shape.
 */
export default function DashboardView() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("monthly");

  const stats = useMemo(() => getSummaryStats(period), [period]);
  const analytics = useMemo(
    () => getOrderAnalytics(statusFilter, period),
    [statusFilter, period]
  );
  const revenue = useMemo(
    () => getRevenueProfile(revenuePeriod),
    [revenuePeriod]
  );
  const performance = useMemo(() => getOrderPerformance(), []);

  const periodOptions = (Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({
    value: p,
    label: PERIOD_LABELS[p],
  }));


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* top row */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* flex column + flex-1 on the stat grid: the card is stretched to the
            height of the donut card beside it, and without this the stats sat
            at the top leaving dead white space below them. */}
        <Card padded={false} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3 sm:px-6">
            <p className="text-sm font-semibold text-heading">Overview</p>
            <Dropdown
              value={period}
              onChange={setPeriod}
              options={periodOptions}
              bordered={false}
            />
          </div>
          <div className="grid flex-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col justify-center p-5 sm:p-6"
              >
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-2 font-display text-3xl font-semibold text-heading">
                  {stat.value}
                </p>
                <p className="mt-3 flex items-center gap-2">
                  <TrendBadge delta={stat.delta} />
                  <span className="text-xs text-faint">
                    vs previous {PERIOD_LABELS[period].toLowerCase()}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="h-full">
          <CardHeader title="Order performance" subtitle="Share of all orders" />
          <div className="mt-5">
            <DonutChart
              centreLabel={String(orders.length)}
              slices={performance.map((p) => ({
                label: p.label,
                value: p.value,
                color: TONE_COLOR[p.tone],
              }))}
            />
          </div>
        </Card>
      </div>

      {/* charts */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-heading">
              Order Analytics
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={(
                  Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]
                ).map((s) => ({ value: s, label: STATUS_FILTER_LABELS[s] }))}
                bordered={false}
              />
              <Dropdown
                value={period}
                onChange={setPeriod}
                options={periodOptions}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-display text-3xl font-semibold text-heading">
              {analytics.total.toLocaleString("en-US")}
            </p>
            <TrendBadge delta={analytics.delta} />
            <span className="text-xs text-faint">
              {STATUS_FILTER_LABELS[statusFilter].toLowerCase()} ·{" "}
              {PERIOD_LABELS[period].toLowerCase()}
            </span>
          </div>

          <div className="mt-5">
            <LineChart
              labels={analytics.labels}
              series={[
                {
                  label: "This period",
                  values: analytics.current,
                  color: "#101828",
                },
                {
                  label: "Previous",
                  values: analytics.previous,
                  color: "#98a2b3",
                  dashed: true,
                },
              ]}
            />
          </div>
        </Card>

        <Card className="h-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-heading">
              Revenue Profile
            </h2>
            <Dropdown
              value={revenuePeriod}
              onChange={setRevenuePeriod}
              options={periodOptions}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-display text-3xl font-semibold text-heading">
              {formatMoneyShort(revenue.total)}
            </p>
            <TrendBadge delta={revenue.delta} />
          </div>

          <div className="mt-5">
            <AreaChart
              labels={revenue.labels}
              values={revenue.points}
              valueFormat={(v) => `${Math.round(v / 1000)}k`}
            />
          </div>
        </Card>
      </div>

      <OrderActivities orders={orders} />
    </div>
  );
}
