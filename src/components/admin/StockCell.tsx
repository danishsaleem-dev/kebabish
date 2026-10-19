"use client";

import { useState } from "react";
import type { StoredItem } from "@/lib/admin/store/types";
import { setStockAction } from "@/app/admin/(dashboard)/menu/actions";
import StockBadge from "@/components/admin/StockBadge";
import { stockLevel, type StockEntry } from "@/lib/stock-status";

/**
 * The stock pill in a row. Click it to change the number without opening the dish: "Set" makes it
 * exactly that, "Add batch" puts a new batch on top of what is left.
 */
export default function StockCell({
  item,
  stock,
}: {
  item: Pick<StoredItem, "slug" | "name">;
  stock: StockEntry | null;
}) {
  const [editing, setEditing] = useState(false);
  const level = stockLevel(stock);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Change the stock"
        aria-label={`Change the stock of ${item.name}`}
        className="rounded-full transition-opacity hover:opacity-80"
      >
        <StockBadge level={level} quantity={stock?.quantity} />
      </button>
    );
  }

  return (
    <form action={setStockAction} onSubmit={() => setEditing(false)} className="flex items-center gap-1.5">
      <input type="hidden" name="slug" value={item.slug} />
      <input
        name="quantity"
        inputMode="numeric"
        autoFocus
        required
        defaultValue={stock?.quantity ?? ""}
        aria-label={`Stock of ${item.name}`}
        className="h-8 w-16 rounded-lg border border-hairline bg-panel px-2 text-sm tabular-nums text-heading focus:border-ember-500 focus:outline-none"
      />
      <button
        type="submit"
        name="mode"
        value="set"
        className="h-8 rounded-lg bg-ember-600 px-2.5 text-xs font-semibold text-cream-50 hover:bg-ember-500"
      >
        Set
      </button>
      <button
        type="submit"
        name="mode"
        value="add"
        className="h-8 rounded-lg border border-hairline px-2.5 text-xs font-semibold text-body-text hover:bg-canvas"
      >
        Add batch
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="h-8 px-1.5 text-xs text-muted hover:text-heading"
      >
        ✕
      </button>
    </form>
  );
}
