"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronsUpDown, Eye } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import TableActions from "@/components/admin/ui/TableActions";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import OrderQuickView from "@/components/admin/OrderQuickView";
import { formatMoney } from "@/lib/admin/units";
import { downloadCsv, stampedFilename, toCsv } from "@/lib/admin/export";
import {
  ORDER_STATUS_LABELS,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin/order-types";

type StatusOption = OrderStatus | "all";
type DaysOption = "today" | "7" | "30" | "all";
type SortKey = "reference" | "customerName" | "placedAt" | "items" | "total";

const DAY_LABELS: Record<DaysOption, string> = {
  today: "Today",
  "7": "Last 7 days",
  "30": "Last 30 days",
  all: "All time",
};

const DAY_WINDOW: Record<DaysOption, number | null> = {
  today: 1,
  "7": 7,
  "30": 30,
  all: null,
};

/** The dashboard's order feed, windowed by real days back from now. */
export default function OrderActivities({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();

  const [status, setStatus] = useState<StatusOption>("all");
  const [days, setDays] = useState<DaysOption>("30");
  const [sort, setSort] = useState<SortKey>("placedAt");
  const [desc, setDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickView, setQuickView] = useState<AdminOrder | null>(null);

  const rows = useMemo(() => {
    const window = DAY_WINDOW[days];
    const cutoff =
      window === null ? -Infinity : Date.now() - (window - 1) * 86_400_000;

    const filtered = orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      return Date.parse(o.placedAt) >= cutoff;
    });

    const itemCount = (o: AdminOrder) =>
      o.lines.reduce((n, l) => n + l.quantity, 0);

    return [...filtered].sort((a, b) => {
      const dir = desc ? -1 : 1;
      switch (sort) {
        case "reference":
          return a.reference.localeCompare(b.reference) * dir;
        case "customerName":
          return a.customerName.localeCompare(b.customerName) * dir;
        case "items":
          return (itemCount(a) - itemCount(b)) * dir;
        case "total":
          return (a.total - b.total) * dir;
        default:
          return (Date.parse(a.placedAt) - Date.parse(b.placedAt)) * dir;
      }
    });
  }, [orders, status, days, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(true);
    }
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const exportRows = () => {
    const source = selected.size
      ? rows.filter((r) => selected.has(r.id))
      : rows;

    downloadCsv(
      stampedFilename("kebabish-order-activities"),
      toCsv(source, [
        { header: "Order ID", value: (o) => o.reference },
        { header: "Customer Name", value: (o) => o.customerName },
        { header: "Date & Time", value: (o) => o.placedAt },
        { header: "Total Item", value: (o) => o.lines.reduce((n, l) => n + l.quantity, 0) },
        { header: "Amount", value: (o) => o.total.toFixed(2) },
        { header: "Status", value: (o) => ORDER_STATUS_LABELS[o.status] },
      ])
    );
  };

  return (
    <>
      <Card padded={false} className="print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Order Activities
            </h2>
            <p className="mt-1 text-sm text-muted">
              Keep track of recent order activities
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Dropdown
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All" },
                ...(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(
                  (s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })
                ),
              ]}
              bordered={false}
            />
            <Dropdown
              label="Days"
              value={days}
              onChange={setDays}
              options={(Object.keys(DAY_LABELS) as DaysOption[]).map((d) => ({
                value: d,
                label: DAY_LABELS[d],
              }))}
              bordered={false}
            />
            <TableActions onExport={exportRows} />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-ember-600/5 px-5 py-3 sm:px-6 print:hidden">
            <p className="text-sm font-medium text-heading">
              {selected.size} selected
            </p>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm font-semibold text-ember-600 hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto border-t border-hairline px-3 pb-3 sm:px-4 sm:pb-4">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="[&>th:first-child]:rounded-l-full [&>th:last-child]:rounded-r-full">
                <th className="w-12 bg-panel py-3 pl-4 ring-1 ring-inset ring-hairline">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(
                        allSelected ? new Set() : new Set(rows.map((r) => r.id))
                      )
                    }
                    className="h-4 w-4 rounded border-hairline accent-ember-600"
                  />
                </th>
                <Th sortKey="reference" {...{ sort, desc, toggleSort }}>Order ID</Th>
                <Th sortKey="customerName" {...{ sort, desc, toggleSort }}>Customer Name</Th>
                <Th sortKey="placedAt" {...{ sort, desc, toggleSort }}>Date &amp; Time</Th>
                <Th sortKey="items" {...{ sort, desc, toggleSort }}>Total Item</Th>
                <Th sortKey="total" {...{ sort, desc, toggleSort }}>Amount</Th>
                <Th>Status</Th>
                <th className="w-16 bg-panel py-3 pr-4 ring-1 ring-inset ring-hairline print:hidden" />
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline">
              {rows.slice(0, 8).map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-canvas/60 ${
                    selected.has(order.id) ? "bg-ember-600/5" : ""
                  }`}
                >
                  <td className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${order.reference}`}
                      checked={selected.has(order.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(order.id)) next.delete(order.id);
                          else next.add(order.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 rounded border-hairline accent-ember-600"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-heading">
                    {order.reference}
                  </td>
                  <td className="px-4 py-4 text-sm text-body-text">
                    {order.customerName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-muted">
                    {new Date(order.placedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(order.placedAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-4 text-sm text-body-text">
                    {order.lines.reduce((n, l) => n + l.quantity, 0)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-heading">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-4 py-4">
                    <OrderStatusPill status={order.status} />
                  </td>
                  <td className="px-4 py-4 print:hidden">
                    <button
                      type="button"
                      aria-label={`Quick view ${order.reference}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickView(order);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ember-600/10 hover:text-ember-600"
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="px-6 py-14 text-center text-sm text-muted">
              No orders in this window.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-5 py-4 sm:px-6 print:hidden">
          <p className="text-sm text-muted">
            Showing {Math.min(8, rows.length)} of {rows.length}
          </p>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember-600 hover:underline"
          >
            View all orders
            <ArrowRight size={15} />
          </Link>
        </div>
      </Card>

      <OrderQuickView order={quickView} onClose={() => setQuickView(null)} />
    </>
  );
}

function Th({
  children,
  sortKey,
  sort,
  desc,
  toggleSort,
}: {
  children: React.ReactNode;
  sortKey?: SortKey;
  sort?: SortKey;
  desc?: boolean;
  toggleSort?: (key: SortKey) => void;
}) {
  const active = sortKey && sort === sortKey;

  return (
    <th
      scope="col"
      className="whitespace-nowrap bg-panel px-4 py-3 ring-1 ring-inset ring-hairline"
    >
      {sortKey && toggleSort ? (
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-heading ${
            active ? "text-heading" : "text-muted"
          }`}
        >
          {children}
          <ChevronsUpDown
            size={13}
            className={
              active
                ? `text-ember-600 ${desc ? "" : "rotate-180"} transition-transform`
                : "text-faint"
            }
          />
        </button>
      ) : (
        <span className="text-xs font-semibold text-muted">{children}</span>
      )}
    </th>
  );
}
