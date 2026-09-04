"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import TrendBadge from "@/components/admin/ui/TrendBadge";
import LineChart from "@/components/admin/charts/LineChart";
import DonutChart from "@/components/admin/charts/DonutChart";
import { ColumnChart, HorizontalBars } from "@/components/admin/charts/BarChart";
import { formatMoney } from "@/lib/admin/units";
import {
  getChannelSplit,
  getOrdersByHour,
  getOrdersByTown,
  getRevenueByMonth,
  getSalesByCategory,
  getTopDishes,
} from "@/lib/admin/mock-data";

type Metric = "revenue" | "orders";
type Range = "6m" | "12m";

const CATEGORY_COLORS = [
  "#a95026", "#c9713e", "#3d3831", "#12b76a", "#f79009", "#98a2b3",
];

export default function ReportsView() {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [range, setRange] = useState<Range>("12m");

  const monthly = useMemo(() => {
    const all = getRevenueByMonth();
    return range === "6m" ? all.slice(-6) : all;
  }, [range]);

  const categories = useMemo(() => getSalesByCategory(), []);
  const topDishes = useMemo(() => getTopDishes(), []);
  const towns = useMemo(() => getOrdersByTown(), []);
  const hours = useMemo(() => getOrdersByHour(), []);
  const channels = useMemo(() => getChannelSplit(), []);

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = monthly.reduce((s, m) => s + m.orders, 0);
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const delta = first
    ? Math.round(
        ((last[metric] - first[metric]) / Math.max(1, first[metric])) * 100
      )
    : 0;

  const headline = [
    { label: "Revenue", value: formatMoney(totalRevenue) },
    { label: "Orders", value: totalOrders.toLocaleString("en-US") },
    {
      label: "Average order",
      value: formatMoney(totalRevenue / Math.max(1, totalOrders)),
    },
    {
      label: "Busiest hour",
      value: hours.reduce((a, b) => (b.value > a.value ? b : a)).label,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3 sm:px-6">
          <p className="text-sm font-semibold text-heading">
            Summary · last {range === "6m" ? "6" : "12"} months
          </p>
          <div className="flex items-center gap-2">
            <Dropdown
              value={range}
              onChange={setRange}
              options={[
                { value: "12m", label: "Last 12 months" },
                { value: "6m", label: "Last 6 months" },
              ]}
            />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
            >
              <Download size={15} />
              Export
            </button>
          </div>
        </div>

        <div className="grid divide-y divide-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          {headline.map((stat) => (
            <div key={stat.label} className="p-5">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-heading">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* trend */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              {metric === "revenue" ? "Revenue" : "Orders"} over time
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <TrendBadge delta={delta} />
              across the period
            </p>
          </div>
          <Dropdown
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "revenue", label: "Revenue" },
              { value: "orders", label: "Orders" },
            ]}
          />
        </div>

        <div className="mt-5">
          <LineChart
            labels={monthly.map((m) => m.label)}
            series={[
              {
                label: metric === "revenue" ? "Revenue" : "Orders",
                values: monthly.map((m) => m[metric]),
                color: "#a95026",
              },
            ]}
            valueFormat={(v) =>
              metric === "revenue"
                ? `${Math.round(v / 1000)}k`
                : Math.round(v).toLocaleString("en-US")
            }
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Sales by category"
            subtitle="Share of total revenue"
          />
          <div className="mt-5">
            <DonutChart
              centreLabel="100%"
              slices={categories.map((c, i) => ({
                label: c.label,
                value: c.value,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Top dishes" subtitle="By orders placed" />
          <div className="mt-5">
            <HorizontalBars
              data={topDishes.map((d) => ({ label: d.name, value: d.orders }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Orders by hour"
            subtitle="When the kitchen actually gets busy"
          />
          <div className="mt-5">
            <ColumnChart data={hours} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders by town" subtitle="Across the delivery area" />
          <div className="mt-5">
            <HorizontalBars data={towns} color="#3d3831" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Ordering channel"
          subtitle="Website checkout vs WhatsApp — both paths matter"
        />
        <div className="mt-5">
          <DonutChart
            centreLabel="Split"
            slices={channels.map((c, i) => ({
              label: c.label,
              value: c.value,
              color: i === 0 ? "#12b76a" : "#a95026",
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
