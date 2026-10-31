"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/admin/ui/Form";
import { GROUP_LABELS } from "@/lib/admin/ingredients";
import { searchIngredients } from "@/lib/ingredient-search";
import type { StoredIngredient } from "@/lib/admin/store/types";

/**
 * A searchable ingredient chooser for recipe lines: type to narrow the list, arrow keys and
 * Enter to pick, Escape to close. It matches the ingredient's name, its supplier and any alias
 * (the Roman Urdu name from the measurement chart), and every word typed must match somewhere,
 * so "haldi" finds Turmeric Powder / Haldi and "little rice" is tolerated in any order.
 *
 * It submits through a hidden `name` field that is always present (empty when nothing is chosen),
 * which the recipe form's parallel-array posting depends on.
 */
export default function IngredientPicker({
  name,
  value,
  onChange,
  ingredients,
  aliases,
  takenIds,
}: {
  name: string;
  value: string;
  onChange: (id: string) => void;
  ingredients: StoredIngredient[];
  /** Extra search words per ingredient id (e.g. the Roman Urdu name). */
  aliases?: Record<string, string[]>;
  /** Ingredients already used on other lines of this recipe — marked, still selectable. */
  takenIds?: Set<string>;
}) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null); // null = not typing
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = ingredients.find((i) => i.id === value);

  const matches = useMemo(
    () => searchIngredients(ingredients, query ?? "", aliases),
    [query, ingredients, aliases]
  );

  const choose = (id: string) => {
    onChange(id);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === "Enter") {
      // Enter inside a list must pick, never submit the whole recipe.
      if (open) {
        ev.preventDefault();
        if (matches[active]) choose(matches[active].id);
      }
    } else if (ev.key === "Escape") {
      if (open) {
        ev.preventDefault();
        setOpen(false);
        setQuery(null);
      }
    }
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        autoComplete="off"
        placeholder="Search ingredients…"
        className="pr-16"
        value={query ?? selected?.name ?? ""}
        onChange={(ev) => {
          setQuery(ev.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(ev) => {
          setOpen(true);
          setActive(0);
          ev.target.select();
        }}
        onBlur={() => {
          setOpen(false);
          setQuery(null);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
        {value && (
          <button
            type="button"
            aria-label="Clear ingredient"
            // mousedown, not click: the input's blur would otherwise close things first.
            onMouseDown={(ev) => {
              ev.preventDefault();
              choose("");
              ev.currentTarget.closest("div.relative")?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-heading"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={15} className="pointer-events-none mr-1 text-faint" aria-hidden="true" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-hairline bg-panel py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">
              No ingredient matches &ldquo;{query}&rdquo;. Add it under Menu → Ingredients first.
            </li>
          ) : (
            matches.map((i, idx) => (
              <li
                key={i.id}
                id={`${listId}-${i.id}`}
                role="option"
                aria-selected={i.id === value}
                // mousedown, not click: the input's blur would otherwise close the list first.
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  choose(i.id);
                }}
                onMouseEnter={() => setActive(idx)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm ${
                  idx === active ? "bg-canvas" : ""
                } ${i.id === value ? "font-semibold text-ember-700" : "text-heading"}`}
              >
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="shrink-0 text-xs text-faint">
                  {takenIds?.has(i.id) && i.id !== value ? "already added · " : ""}
                  {GROUP_LABELS[i.group]}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
