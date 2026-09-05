"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Eye, Globe, MessageCircle, Search, X } from "lucide-react";
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
type ChannelOption = "all" | "whatsapp" | "website";
type SortKey = "reference" | "customerName" | "items" | "placedAt" | "total" | "status";

export default function OrdersTable({
  orders,
  title = "Orders",
  lockedStatus,
}: {
  orders: AdminOrder[];
  title?: string;
  lockedStatus?: OrderStatus;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusOption>(lockedStatus ?? "all");
  const [channel, setChannel] = useState<ChannelOption>("all");
  const [sort, setSort] = useState<SortKey>("placedAt");
  const [desc, setDesc] = useState(true);
  const [quickView, setQuickView] = useState<AdminOrder | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (channel !== "all" && o.channel !== channel) return false;
      if (!q) return true;
      return (
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.town.toLowerCase().includes(q) ||
        o.lines.some((l) => l.name.toLowerCase().includes(q))
      );
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
        case "status":
          return a.status.localeCompare(b.status) * dir;
        default:
          return (Date.parse(a.placedAt) - Date.parse(b.placedAt)) * dir;
      }
    });
  }, [orders, query, status, channel, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(true);
    }
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () =>
    setSelected(
      allOnPageSelected ? new Set() : new Set(rows.map((r) => r.id))
    );

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportRows = () => {
    // Export the selection if there is one, otherwise everything on screen.
    const source = selected.size
      ? rows.filter((r) => selected.has(r.id))
      : rows;

    downloadCsv(
      stampedFilename("kebabish-orders"),
      toCsv(source, [
        { header: "Reference", value: (o) => o.reference },
        { header: "Placed at", value: (o) => o.placedAt },
        { header: "Customer", value: (o) => o.customerName },
        { header: "Phone", value: (o) => o.phone },
        { header: "Town", value: (o) => o.town },
        { header: "Items", value: (o) => o.lines.reduce((n, l) => n + l.quantity, 0) },
        { header: "Dishes", value: (o) => o.lines.map((l) => `${l.quantity}x ${l.name}`).join(" | ") },
        { header: "Channel", value: (o) => o.channel },
        { header: "Fulfilment", value: (o) => o.fulfilment },
        { header: "Subtotal", value: (o) => o.subtotal.toFixed(2) },
        { header: "Delivery fee", value: (o) => o.deliveryFee.toFixed(2) },
        { header: "Total", value: (o) => o.total.toFixed(2) },
        { header: "Status", value: (o) => ORDER_STATUS_LABELS[o.status] },
      ])
    );
  };

  const revenue = rows.reduce(
    (sum, o) => sum + (o.status === "cancelled" ? 0 : o.total),
    0
  );

  return (
    <>
      <Card padded={false} className="print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {rows.length} of {orders.length} orders · {formatMoney(revenue)}{" "}
              excluding cancelled
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <label className="relative">
              <span className="sr-only">Search orders</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders…"
                className="h-10 w-48 rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
              />
            </label>

            {!lockedStatus && (
              <Dropdown
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All statuses" },
                  ...(
                    Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]
                  ).map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
                ]}
              />
            )}

            <Dropdown
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "all", label: "All channels" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "website", label: "Website" },
              ]}
            />

            <TableActions onExport={exportRows} />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-ember-600/5 px-5 py-3 sm:px-6 print:hidden">
            <p className="text-sm font-medium text-heading">
              {selected.size} order{selected.size === 1 ? "" : "s"} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportRows}
                className="rounded-lg border border-hairline bg-panel px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
              >
                Export selection
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                aria-label="Clear selection"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-heading"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto border-t border-hairline px-3 pb-3 sm:px-4 sm:pb-4">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              {/* Pill-shaped header row, matching the reference design. */}
              <tr className="[&>th:first-child]:rounded-l-full [&>th:last-child]:rounded-r-full">
                <th className="w-12 bg-panel py-3 pl-4 ring-1 ring-inset ring-hairline">
                  <input
                    type="checkbox"
                    aria-label="Select all orders"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-hairline accent-ember-600"
                  />
                </th>
                <Th sortKey="reference" {...{ sort, desc, toggleSort }}>Order ID</Th>
                <Th sortKey="customerName" {...{ sort, desc, toggleSort }}>Customer Name</Th>
                <Th sortKey="placedAt" {...{ sort, desc, toggleSort }}>Date &amp; Time</Th>
                <Th sortKey="items" {...{ sort, desc, toggleSort }}>Total Item</Th>
                <Th>Channel</Th>
                <Th sortKey="total" {...{ sort, desc, toggleSort }}>Amount</Th>
                <Th sortKey="status" {...{ sort, desc, toggleSort }}>Status</Th>
                <th className="w-16 bg-panel py-3 pr-4 ring-1 ring-inset ring-hairline print:hidden" />
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline">
              {rows.map((order) => (
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
                      onChange={() => toggleOne(order.id)}
                      className="h-4 w-4 rounded border-hairline accent-ember-600"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-heading">
                    {order.reference}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-body-text">{order.customerName}</p>
                    <p className="text-xs text-muted">{order.town}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-muted">
                    {new Date(order.placedAt).toLocaleString("en-GB", {
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
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-body-text">
                      {order.channel === "whatsapp" ? (
                        <MessageCircle size={13} className="text-success" />
                      ) : (
                        <Globe size={13} className="text-ember-600" />
                      )}
                      {order.channel === "whatsapp" ? "WhatsApp" : "Website"}
                    </span>
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
            <p className="px-6 py-16 text-center text-sm text-muted">
              No orders match those filters.{" "}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus(lockedStatus ?? "all");
                  setChannel("all");
                }}
                className="font-semibold text-ember-600 hover:underline"
              >
                Clear filters
              </button>
            </p>
          )}
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
          aria-label={`Sort by ${String(children)}`}
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
