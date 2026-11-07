"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Flame,
  Leaf,
  Pencil,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { formatMoney } from "@/lib/admin/units";
import {
  deleteItemAction,
  moveItemAction,
  toggleItemVisibilityAction,
} from "@/app/admin/(dashboard)/menu/actions";
import type { StoredCategory, StoredItem } from "@/lib/admin/store/types";
import StockCell from "@/components/admin/StockCell";
import QuickEditRow from "@/components/admin/QuickEditRow";
import BulkEditPanel from "@/components/admin/BulkEditPanel";
import { stockLevel, type StockEntry } from "@/lib/stock-status";

export interface ItemRow {
  item: StoredItem;
  categoryLabel: string;
  costPerPortion: number | null;
  /** Null = the dish doesn't track stock. */
  stock: StockEntry | null;
}

type SortKey = "order" | "name" | "category" | "price" | "cost" | "stock";

/** Worst first: out, then low, then ok, then untracked. */
const STOCK_RANK = { out: 0, low: 1, ok: 2, untracked: 3 } as const;

export default function ItemsTable({
  rows,
  categories,
  stockSetUp = true,
}: {
  rows: ItemRow[];
  categories: StoredCategory[];
  /** False until migration 0022 has been run — the column then explains itself instead of offering edits. */
  stockSetUp?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">(
    "all"
  );
  // "order" is the real menu order — what customers see — and the only
  // sort the up/down arrows make sense in.
  const [sort, setSort] = useState<SortKey>("order");
  const [desc, setDesc] = useState(false);
  const [stockFilter, setStockFilter] = useState<"all" | "attention">("all");
  // Which row is folded open for quick edit (one at a time, like WooCommerce), and which
  // rows are ticked for a bulk edit. Both are slugs.
  const [quickEditing, setQuickEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Position in the store's array = position on the public menu, within a
  // category. First/last per category decides which arrows are live.
  const orderIndex = useMemo(
    () => new Map(rows.map((r, i) => [r.item.slug, i])),
    [rows]
  );
  const categoryPosition = useMemo(
    () => new Map(categories.map((c) => [c.id, c.position])),
    [categories]
  );
  const edges = useMemo(() => {
    const first = new Map<string, string>();
    const last = new Map<string, string>();
    for (const { item } of rows) {
      if (!first.has(item.categoryId)) first.set(item.categoryId, item.slug);
      last.set(item.categoryId, item.slug);
    }
    return { first, last };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rowsFiltered = rows.filter(({ item, stock }) => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (visibility === "visible" && !item.visible) return false;
      if (visibility === "hidden" && item.visible) return false;
      if (stockFilter === "attention") {
        const level = stockLevel(stock);
        if (level !== "low" && level !== "out") return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.nameEn ?? "").toLowerCase().includes(q)
      );
    });

    return [...rowsFiltered].sort((a, b) => {
      const dir = desc ? -1 : 1;
      switch (sort) {
        case "order":
          return (
            ((categoryPosition.get(a.item.categoryId) ?? 0) -
              (categoryPosition.get(b.item.categoryId) ?? 0) ||
              (orderIndex.get(a.item.slug) ?? 0) - (orderIndex.get(b.item.slug) ?? 0)) *
            dir
          );
        case "category":
          return a.categoryLabel.localeCompare(b.categoryLabel) * dir;
        case "price":
          return ((a.item.price ?? -1) - (b.item.price ?? -1)) * dir;
        case "cost":
          return ((a.costPerPortion ?? -1) - (b.costPerPortion ?? -1)) * dir;
        case "stock":
          return (STOCK_RANK[stockLevel(a.stock)] - STOCK_RANK[stockLevel(b.stock)] ||
            (a.stock?.quantity ?? 0) - (b.stock?.quantity ?? 0)) * dir;
        default:
          return a.item.name.localeCompare(b.item.name) * dir;
      }
    });
  }, [rows, query, categoryId, visibility, stockFilter, sort, desc, categoryPosition, orderIndex]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(false);
    }
  };

  // Ticking only ever covers what is on screen: "select all" on a filtered list that quietly
  // included the dishes the filter hid is how a bulk edit goes wrong.
  const visibleSlugs = filtered.map((r) => r.item.slug);
  const chosen = selected.filter((slug) => visibleSlugs.includes(slug));
  const allShown = visibleSlugs.length > 0 && chosen.length === visibleSlugs.length;
  const toggleRow = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  const clearSelection = () => {
    setSelected([]);
    setBulkOpen(false);
  };
  /** Columns in the table — the quick-edit form spans all of them. */
  const COLUMNS = 9;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-heading">
            All items
          </h2>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} of {rows.length} dishes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search dishes</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes…"
              className="h-10 w-48 rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
            />
          </label>

          <Dropdown
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.label })),
            ]}
          />

          <Dropdown
            label="Shown"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "all", label: "All" },
              { value: "visible", label: "On website" },
              { value: "hidden", label: "Hidden" },
            ]}
          />

          <Dropdown
            label="Stock"
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { value: "all", label: "All" },
              { value: "attention", label: "Low or out" },
            ]}
          />
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline bg-ember-600/5 px-5 py-3 sm:px-6">
          <p className="text-sm font-semibold text-heading">
            {chosen.length} selected
          </p>
          <button
            type="button"
            onClick={() => setBulkOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ember-600 px-3.5 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <SlidersHorizontal size={14} />
            {bulkOpen ? "Hide bulk edit" : "Bulk edit"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm font-semibold text-muted transition-colors hover:text-heading"
          >
            Clear selection
          </button>
        </div>
      )}

      {chosen.length > 0 && bulkOpen && (
        <BulkEditPanel slugs={chosen} categories={categories} onDone={clearSelection} />
      )}

      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas/60">
              <th scope="col" className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allShown}
                  onChange={() =>
                    setSelected(allShown ? [] : [...new Set([...selected, ...visibleSlugs])])
                  }
                  aria-label={allShown ? "Clear selection" : "Select every dish shown"}
                  className="h-4 w-4 rounded border-hairline accent-ember-600"
                />
              </th>
              <Th sortKey="order" {...{ sort, desc, toggleSort }}>
                Menu order
              </Th>
              <Th sortKey="name" {...{ sort, desc, toggleSort }}>
                Dish
              </Th>
              <Th sortKey="category" {...{ sort, desc, toggleSort }}>
                Category
              </Th>
              <Th sortKey="price" {...{ sort, desc, toggleSort }}>
                Price
              </Th>
              <Th sortKey="stock" {...{ sort, desc, toggleSort }}>
                Stock
              </Th>
              <Th sortKey="cost" {...{ sort, desc, toggleSort }}>
                Recipe
              </Th>
              <th className="px-4 py-3 text-xs font-semibold text-muted">
                On website
              </th>
              <th className="w-44 px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {filtered.map(({ item, categoryLabel, costPerPortion, stock }) => (
              <Fragment key={item.slug}>
              <tr
                onClick={() => router.push(`/admin/menu/items/${item.slug}/edit`)}
                className={`cursor-pointer transition-colors hover:bg-canvas/60 ${
                  chosen.includes(item.slug) ? "bg-ember-600/5" : ""
                }`}
              >
                <td className="w-12 px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(item.slug)}
                    onChange={() => toggleRow(item.slug)}
                    aria-label={`Select ${item.name}`}
                    className="h-4 w-4 rounded border-hairline accent-ember-600"
                  />
                </td>
                <td
                  className="w-24 px-4 py-4"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {sort === "order" && !desc ? (
                    <div className="flex items-center gap-1">
                      {(["up", "down"] as const).map((direction) => {
                        const atEdge =
                          (direction === "up" ? edges.first : edges.last).get(
                            item.categoryId
                          ) === item.slug;
                        const Icon = direction === "up" ? ArrowUp : ArrowDown;
                        return (
                          <form action={moveItemAction} key={direction}>
                            <input type="hidden" name="slug" value={item.slug} />
                            <input type="hidden" name="direction" value={direction} />
                            <button
                              type="submit"
                              disabled={atEdge}
                              aria-label={`Move ${item.name} ${direction} within its category`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted"
                            >
                              <Icon size={15} />
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </td>
                <td className="px-5 py-4 sm:px-6">
                  <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                    {item.name}
                    {item.featured && (
                      <Star
                        size={14}
                        className="shrink-0 fill-ember-600 text-ember-600"
                        aria-label="Featured on the homepage"
                      />
                    )}
                    {item.vegetarian && (
                      <Leaf size={14} className="shrink-0 text-success" />
                    )}
                    {item.spicy && (
                      <Flame size={14} className="shrink-0 text-danger" />
                    )}
                    {item.soldOut && (
                      <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                        sold out
                      </span>
                    )}
                  </p>
                  {item.variants.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {item.variants.join(" · ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-body-text">
                  {categoryLabel}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-heading">
                  {item.price != null ? (
                    formatMoney(item.price)
                  ) : (
                    <span className="font-normal text-warn">Not set</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                  {stockSetUp ? (
                    <StockCell item={item} stock={stock} />
                  ) : (
                    <span className="text-xs text-faint" title="Run migration 0022 to turn stock tracking on">
                      Not set up
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-body-text">
                  {costPerPortion != null ? (
                    <>
                      {formatMoney(costPerPortion)}
                      <span className="ml-1 text-xs text-muted">/portion</span>
                    </>
                  ) : (
                    <span className="text-faint">Not added</span>
                  )}
                </td>
                <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                  <form action={toggleItemVisibilityAction}>
                    <input type="hidden" name="slug" value={item.slug} />
                    <input
                      type="hidden"
                      name="visible"
                      value={String(item.visible)}
                    />
                    <button
                      type="submit"
                      aria-label={
                        item.visible
                          ? `Hide ${item.name} from the website`
                          : `Show ${item.name} on the website`
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        item.visible
                          ? "border-success/30 bg-success-soft text-success hover:bg-success-soft/70"
                          : "border-hairline text-muted hover:bg-canvas"
                      }`}
                    >
                      {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      {item.visible ? "Visible" : "Hidden"}
                    </button>
                  </form>
                </td>
                <td
                  className="px-4 py-4"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setQuickEditing((open) => (open === item.slug ? null : item.slug))
                      }
                      aria-expanded={quickEditing === item.slug}
                      className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        quickEditing === item.slug
                          ? "bg-ember-600 text-cream-50"
                          : "text-muted hover:bg-canvas hover:text-heading"
                      }`}
                    >
                      Quick edit
                    </button>
                    <a
                      href={`/admin/menu/items/${item.slug}/edit`}
                      aria-label={`Open the full editor for ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                    >
                      <Pencil size={15} />
                    </a>
                    <DeleteButton
                      action={deleteItemAction}
                      hiddenField={{ name: "slug", value: item.slug }}
                      label={`Delete ${item.name}`}
                      compact
                    />
                  </div>
                </td>
              </tr>

              {quickEditing === item.slug && (
                <QuickEditRow
                  item={item}
                  categories={categories}
                  columns={COLUMNS}
                  onDone={() => setQuickEditing(null)}
                />
              )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-muted">
            No dishes match those filters.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryId("all");
                setVisibility("all");
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
  sortKey,
  sort,
  desc,
  toggleSort,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  sort: SortKey;
  desc: boolean;
  toggleSort: (key: SortKey) => void;
}) {
  const active = sort === sortKey;

  return (
    <th scope="col" className="px-4 py-3">
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
              ? `text-ember-600 ${desc ? "rotate-180" : ""} transition-transform`
              : "text-faint"
          }
        />
      </button>
    </th>
  );
}
