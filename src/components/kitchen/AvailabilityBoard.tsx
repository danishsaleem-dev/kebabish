"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Package, Search, X } from "lucide-react";
import { setDealAvailabilityAction, setDishAvailabilityAction } from "@/app/kitchen/availability/actions";

export interface AvailabilityRow {
  kind: "dish" | "deal";
  slug: string;
  name: string;
  /** The dish's or deal's own switch — what this screen writes. */
  switchedOff: boolean;
  /** Portions left, for a dish that tracks stock. Null when it doesn't. */
  stockLeft: number | null;
  /**
   * Unavailable for a reason this screen can't undo: a dish with no stock left, or a
   * deal whose parts can't all be served. Shown, never hidden, so nobody flips a
   * switch and wonders why nothing changed.
   */
  blocked: string | null;
}

export interface AvailabilityGroup {
  id: string;
  label: string;
  rows: AvailabilityRow[];
}

const keyOf = (row: { kind: string; slug: string }) => `${row.kind}:${row.slug}`;

/** Accents off, lower case — so "kofte" finds "Köfte". */
const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The kitchen's own availability screen: every dish and deal on the menu with one
 * switch each, so a cook who has run out of something takes it off the website
 * themselves instead of ringing whoever has the admin open.
 *
 * The switch is the dish's **own** `soldOut` flag — the same one `/admin/menu` sets —
 * not a second kitchen-only one that could disagree with it. A sold-out dish still
 * shows on the site, marked unavailable, with the "request it" form; it does not
 * vanish. What this screen cannot undo it says instead of pretending: a dish whose
 * tracked stock is at zero, and a deal that can't be built from what is left.
 */
export default function AvailabilityBoard({ groups }: { groups: AvailabilityGroup[] }) {
  const [off, setOff] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [keyOf(r), r.switchedOff])))
  );
  const [tab, setTab] = useState(() => groups[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [unavailableOnly, setUnavailableOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAvailable = (row: AvailabilityRow) => !off[keyOf(row)] && !row.blocked;

  const all = useMemo(
    () => groups.flatMap((g) => g.rows.map((row) => ({ row, groupLabel: g.label }))),
    [groups]
  );
  const unavailableCount = all.filter(({ row }) => !isAvailable(row)).length;

  const search = normalise(query.trim());
  const searching = search.length > 0;
  const active = groups.find((g) => g.id === tab) ?? groups[0];

  const shown = (searching ? all : (active?.rows ?? []).map((row) => ({ row, groupLabel: "" }))).filter(
    ({ row }) =>
      (!searching || normalise(row.name).includes(search)) && (!unavailableOnly || !isAvailable(row))
  );

  async function toggle(row: AvailabilityRow) {
    const key = keyOf(row);
    const next = Boolean(off[key]); // currently switched off -> turning it back on
    setBusy(key);
    setError(null);
    setOff((prev) => ({ ...prev, [key]: !next }));

    const result =
      row.kind === "deal"
        ? await setDealAvailabilityAction(row.slug, next)
        : await setDishAvailabilityAction(row.slug, next);

    setBusy(null);
    if (!result.ok) {
      setOff((prev) => ({ ...prev, [key]: next }));
      setError(result.message ?? "That didn't save — try again.");
    }
  }

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center sm:px-6">
        <Package size={40} className="mx-auto text-faint" />
        <p className="mt-3 font-display text-xl font-semibold text-heading">Nothing on the menu yet</p>
        <p className="mt-1 text-sm text-muted">Dishes added in the admin show up here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <div className="mb-4">
        <h1 className="font-display text-xl font-semibold text-heading">Item availability</h1>
        <p className="mt-1 text-sm text-muted">
          Switch something off and it shows as unavailable on the website straight away — it stays on the
          menu, so customers can still ask for it. Switch it back on when you have it again.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* ---- search, filter, and how much is off ---- */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a dish or deal"
              aria-label="Search for a dish or deal"
              className="h-11 w-full rounded-xl border border-hairline bg-panel pl-9 pr-9 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-faint hover:bg-canvas hover:text-heading"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-hairline bg-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Filter</p>
            <label className="mt-2.5 flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-body-text">
              <span>Show unavailable only ({unavailableCount})</span>
              <input
                type="checkbox"
                checked={unavailableOnly}
                onChange={(e) => setUnavailableOnly(e.target.checked)}
                className="h-4.5 w-4.5 accent-ember-600"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-hairline bg-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">On the menu</p>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-sm text-muted">Dishes and deals</span>
              <span className="font-display text-base font-semibold tabular-nums text-heading">{all.length}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline">
              <span
                className="block h-full rounded-full bg-ember-600 transition-[width]"
                style={{ width: `${all.length ? Math.round((unavailableCount / all.length) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {unavailableCount === 0 ? "Everything is available" : `${unavailableCount} unavailable`}
            </p>
          </div>
        </div>

        {/* ---- the list ---- */}
        <div className="min-w-0 rounded-2xl border border-hairline bg-panel">
          <div className="flex gap-1.5 overflow-x-auto border-b border-hairline p-2">
            {groups.map((g) => {
              const activeTab = !searching && g.id === active?.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTab(g.id);
                  }}
                  aria-current={activeTab ? "true" : undefined}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                    activeTab ? "bg-charcoal-600 text-white" : "text-body-text hover:bg-canvas"
                  }`}
                >
                  {g.label} ({g.rows.length})
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">
              {searching ? `Nothing matches “${query.trim()}”.` : "Nothing here."}
            </p>
          ) : (
            <ul>
              {shown.map(({ row, groupLabel }) => {
                const key = keyOf(row);
                const available = isAvailable(row);
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${available ? "text-heading" : "text-muted line-through"}`}>
                        {row.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        {groupLabel && <span>{groupLabel}</span>}
                        {row.kind === "deal" && (
                          <span className="rounded bg-canvas px-1.5 py-0.5 font-semibold text-body-text">Deal</span>
                        )}
                        {row.stockLeft !== null && (
                          <span className="tabular-nums">
                            {row.stockLeft} left
                          </span>
                        )}
                        {row.blocked && (
                          <span className="inline-flex items-center gap-1 font-semibold text-warn">
                            <AlertTriangle size={12} />
                            {row.blocked}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={available}
                      aria-label={`${row.name} is available`}
                      disabled={Boolean(row.blocked) || busy === key}
                      title={row.blocked ?? undefined}
                      onClick={() => toggle(row)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        available ? "bg-success" : "bg-faint"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                          available ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
