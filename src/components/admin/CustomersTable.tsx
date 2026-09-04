"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Globe, MessageCircle, Search } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import { formatMoney } from "@/lib/admin/units";
import {
  CUSTOMER_STATUS_LABELS,
  type CustomerStatus,
  type MockCustomer,
} from "@/lib/admin/mock-data";

type StatusOption = CustomerStatus | "all";
type SortKey = "name" | "orderCount" | "totalSpent" | "lastOrderAt";

const STATUS_TONE: Record<CustomerStatus, string> = {
  new: "bg-ember-600/10 text-ember-700",
  active: "bg-success-soft text-success",
  lapsed: "bg-canvas text-muted",
};

export default function CustomersTable({
  customers,
}: {
  customers: MockCustomer[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusOption>("all");
  const [town, setTown] = useState("all");
  const [sort, setSort] = useState<SortKey>("totalSpent");
  const [desc, setDesc] = useState(true);

  const towns = useMemo(
    () => [...new Set(customers.map((c) => c.town))].sort(),
    [customers]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = customers.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (town !== "all" && c.town !== town) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.town.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const dir = desc ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      if (sort === "orderCount") return (a.orderCount - b.orderCount) * dir;
      if (sort === "totalSpent") return (a.totalSpent - b.totalSpent) * dir;
      return (Date.parse(a.lastOrderAt) - Date.parse(b.lastOrderAt)) * dir;
    });
  }, [customers, query, status, town, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(true);
    }
  };

  const lifetime = rows.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-heading">
            Customers
          </h2>
          <p className="mt-1 text-sm text-muted">
            {rows.length} of {customers.length} · {formatMoney(lifetime)} lifetime
            value
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search customers</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              className="h-10 w-48 rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
            />
          </label>

          <Dropdown
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All customers" },
              ...(
                Object.keys(CUSTOMER_STATUS_LABELS) as CustomerStatus[]
              ).map((s) => ({ value: s, label: CUSTOMER_STATUS_LABELS[s] })),
            ]}
          />

          <Dropdown
            label="Town"
            value={town}
            onChange={setTown}
            options={[
              { value: "all", label: "All towns" },
              ...towns.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas/60">
              <Th onClick={() => toggleSort("name")}>Customer</Th>
              <Th>Town</Th>
              <Th onClick={() => toggleSort("orderCount")}>Orders</Th>
              <Th onClick={() => toggleSort("totalSpent")}>Lifetime value</Th>
              <Th onClick={() => toggleSort("lastOrderAt")}>Last order</Th>
              <Th>Channel</Th>
              <Th>Status</Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {rows.map((customer) => (
              <tr
                key={customer.id}
                onClick={() => router.push(`/admin/customers/${customer.id}`)}
                className="cursor-pointer transition-colors hover:bg-canvas/60"
              >
                <td className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-600/10 font-display text-sm font-semibold text-ember-700">
                      {customer.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-heading">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {customer.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-body-text">
                  {customer.town}
                </td>
                <td className="px-4 py-4 text-sm text-body-text">
                  {customer.orderCount}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-heading">
                  {formatMoney(customer.totalSpent)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-muted">
                  {new Date(customer.lastOrderAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-body-text">
                    {customer.preferredChannel === "whatsapp" ? (
                      <MessageCircle size={13} className="text-success" />
                    ) : (
                      <Globe size={13} className="text-ember-600" />
                    )}
                    {customer.preferredChannel === "whatsapp"
                      ? "WhatsApp"
                      : "Website"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[customer.status]}`}
                  >
                    {CUSTOMER_STATUS_LABELS[customer.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-muted">
            No customers match those filters.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setTown("all");
              }}
              className="font-semibold text-ember-600 hover:underline"
            >
              Clear filters
            </button>
          </p>
        )}
      </div>
    </Card>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th scope="col" className="px-5 py-3 sm:px-6">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-heading"
        >
          {children}
          <ChevronsUpDown size={13} className="text-faint" />
        </button>
      ) : (
        <span className="text-xs font-semibold text-muted">{children}</span>
      )}
    </th>
  );
}
