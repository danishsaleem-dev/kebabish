import Link from "next/link";
import { Bike, CalendarDays, MapPin, Phone, Printer, Search } from "lucide-react";
import { listKitchenHistory } from "@/lib/admin/orders-data";
import { amsterdamDateAhead, amsterdamNow } from "@/lib/delivery-slots";
import OrderStatusPill from "@/components/admin/OrderStatusPill";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history | Kebabish Kitchen" };

type Range = "today" | "yesterday" | "week" | "date";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
];

const isDateKey = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function dayHeading(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * What went out of the kitchen: finished, on-the-way and cancelled orders for a
 * day (or the last week), newest first, with the customer's phone and address and a
 * button to print the ticket again. Searchable by order number, name, phone or street.
 * Everything is in the URL (`?range=…&date=…&q=…`), so a day can be bookmarked and the
 * browser's back button behaves.
 */
export default async function KitchenHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; q?: string }>;
}) {
  const params = await searchParams;
  const today = amsterdamNow().dateKey;
  const yesterday = amsterdamDateAhead(-1).dateKey;

  const picked = isDateKey(params.date) ? params.date : null;
  const range: Range = picked
    ? "date"
    : params.range === "yesterday" || params.range === "week"
      ? params.range
      : "today";

  const from =
    range === "date" && picked ? picked : range === "yesterday" ? yesterday : range === "week" ? amsterdamDateAhead(-6).dateKey : today;
  const to = range === "date" && picked ? picked : range === "yesterday" ? yesterday : today;

  const q = (params.q ?? "").trim().slice(0, 60);
  const all = await listKitchenHistory({ from, to });
  const needle = q.toLowerCase();
  const orders = needle
    ? all.filter((o) =>
        [o.reference, o.customerName, o.phone, o.address, ...o.lines.map((l) => l.name)]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
    : all;

  // Group by the day the order was for.
  const dayOf = (o: (typeof orders)[number]) =>
    o.deliveryDate ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(o.placedAt));
  const groups = new Map<string, typeof orders>();
  for (const o of orders) {
    const day = dayOf(o);
    groups.set(day, [...(groups.get(day) ?? []), o]);
  }

  const keep = (r: Range) => `/kitchen/history?range=${r}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const pill = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "border-ember-600 bg-ember-600 text-white" : "border-hairline bg-panel text-body-text hover:bg-canvas"
    }`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-heading">Order history</h1>
      <p className="mt-1 text-sm text-muted">Orders that are out for delivery, delivered or cancelled.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link key={r.id} href={keep(r.id)} className={pill(range === r.id)} aria-current={range === r.id ? "page" : undefined}>
            {r.label}
          </Link>
        ))}

        <form action="/kitchen/history" className="flex items-center gap-2">
          <label className="sr-only" htmlFor="history-date">
            Pick a day
          </label>
          <span className="relative">
            <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="history-date"
              type="date"
              name="date"
              defaultValue={picked ?? ""}
              max={today}
              className={`h-10 rounded-full border bg-panel pl-9 pr-3 text-sm font-semibold text-heading focus:outline-none ${
                range === "date" ? "border-ember-600" : "border-hairline"
              }`}
            />
          </span>
          {q && <input type="hidden" name="q" value={q} />}
          <button type="submit" className={pill(range === "date")}>
            Show day
          </button>
        </form>
      </div>

      <form action="/kitchen/history" className="mt-4 flex gap-2">
        {range !== "today" && (picked ? <input type="hidden" name="date" value={picked} /> : <input type="hidden" name="range" value={range} />)}
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search orders</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search order number, name, phone, street or dish…"
            className="h-11 w-full rounded-xl border border-hairline bg-panel pl-10 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
          />
        </label>
        <button type="submit" className="h-11 rounded-xl bg-charcoal-600 px-5 text-sm font-semibold text-cream-50 hover:bg-charcoal-500">
          Search
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        {orders.length === 0
          ? "No orders found for this."
          : `${orders.length} order${orders.length === 1 ? "" : "s"}${from === to ? ` on ${dayHeading(from)}` : ` from ${dayHeading(from)} to ${dayHeading(to)}`}${q ? ` matching “${q}”` : ""}`}
      </p>

      <div className="mt-4 space-y-8">
        {[...groups.entries()].map(([day, list]) => (
          <section key={day}>
            {groups.size > 1 && (
              <h2 className="mb-3 font-display text-lg font-semibold capitalize text-heading">{dayHeading(day)}</h2>
            )}
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((o) => (
                <li key={o.id} className="flex flex-col rounded-2xl border border-hairline bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold leading-none text-heading">{o.reference}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-body-text">{o.customerName}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <OrderStatusPill status={o.status} />
                      {o.deliverySlotStart && (
                        <span className="text-xs font-semibold tabular-nums text-muted">
                          {o.deliverySlotStart}–{o.deliverySlotEnd}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-[0.95rem] text-heading">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-8 shrink-0 text-right font-semibold text-ember-700">{l.quantity}×</span>
                        <span>{l.name}</span>
                      </li>
                    ))}
                  </ul>

                  {o.note && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{o.note}</p>}

                  <div className="mt-3 space-y-1.5 text-sm text-body-text">
                    <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:text-ember-700">
                      <Phone size={14} className="shrink-0 text-muted" />
                      <span className="tabular-nums">{o.phone}</span>
                    </a>
                    <p className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-muted" />
                      <span>{o.address}</span>
                    </p>
                    {o.assignedRiderName && (
                      <p className="flex items-center gap-2">
                        <Bike size={14} className="shrink-0 text-muted" />
                        {o.assignedRiderName}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-4">
                    <a
                      href={`/admin/orders/${o.id}/ticket`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-hairline px-4 text-sm font-semibold text-body-text hover:bg-canvas"
                    >
                      <Printer size={16} />
                      Print ticket again
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
