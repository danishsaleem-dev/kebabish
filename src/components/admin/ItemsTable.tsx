"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  Eye,
  EyeOff,
  Flame,
  Leaf,
  Pencil,
  Search,
} from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { formatMoney } from "@/lib/admin/units";
import {
  deleteItemAction,
  toggleItemVisibilityAction,
} from "@/app/admin/(dashboard)/menu/actions";
import type { StoredCategory, StoredItem } from "@/lib/admin/store/types";

export interface ItemRow {
  item: StoredItem;
  categoryLabel: string;
  costPerPortion: number | null;
}

type SortKey = "name" | "category" | "price" | "cost";

export default function ItemsTable({
  rows,
  categories,
}: {
  rows: ItemRow[];
  categories: StoredCategory[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">(
    "all"
  );
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rowsFiltered = rows.filter(({ item }) => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (visibility === "visible" && !item.visible) return false;
      if (visibility === "hidden" && item.visible) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });

    return [...rowsFiltered].sort((a, b) => {
      const dir = desc ? -1 : 1;
      switch (sort) {
        case "category":
          return a.categoryLabel.localeCompare(b.categoryLabel) * dir;
        case "price":
          return ((a.item.price ?? -1) - (b.item.price ?? -1)) * dir;
        case "cost":
          return ((a.costPerPortion ?? -1) - (b.costPerPortion ?? -1)) * dir;
        default:
          return a.item.name.localeCompare(b.item.name) * dir;
      }
    });
  }, [rows, query, categoryId, visibility, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(false);
    }
  };

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
        </div>
      </div>

      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas/60">
              <Th sortKey="name" {...{ sort, desc, toggleSort }}>
                Dish
              </Th>
              <Th sortKey="category" {...{ sort, desc, toggleSort }}>
                Category
              </Th>
              <Th sortKey="price" {...{ sort, desc, toggleSort }}>
                Price
              </Th>
              <Th sortKey="cost" {...{ sort, desc, toggleSort }}>
                Recipe
              </Th>
              <th className="px-4 py-3 text-xs font-semibold text-muted">
                On website
              </th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {filtered.map(({ item, categoryLabel, costPerPortion }) => (
              <tr
                key={item.slug}
                onClick={() => router.push(`/admin/menu/items/${item.slug}/edit`)}
                className="cursor-pointer transition-colors hover:bg-canvas/60"
              >
                <td className="px-5 py-4 sm:px-6">
                  <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                    {item.name}
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
                    <a
                      href={`/admin/menu/items/${item.slug}/edit`}
                      aria-label={`Edit ${item.name}`}
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
