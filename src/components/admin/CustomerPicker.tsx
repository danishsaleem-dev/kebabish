"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UserRound, X } from "lucide-react";
import type { CustomerOption } from "@/lib/admin/orders-data";

/**
 * "Existing customer" search on the Create order form. Type a name, phone number or email, pick the
 * person, and their details (and last address) fill the boxes below — so a returning customer is
 * never re-typed, and the order is linked to the right account. Not finding them is fine: the boxes
 * below still work for someone new.
 */
const MAX_RESULTS = 8;

const digits = (v: string) => v.replace(/\D/g, "");

export default function CustomerPicker({
  customers,
  selected,
  onPick,
  onClear,
}: {
  customers: CustomerOption[];
  selected: CustomerOption | null;
  onPick: (customer: CustomerOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const qDigits = digits(q);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && digits(c.phone).includes(qDigits))
      )
      .slice(0, MAX_RESULTS);
  }, [customers, query]);

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-success/30 bg-success-soft px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-heading">
              {selected.name}
              <span className="ml-2 rounded-full bg-panel px-2 py-0.5 text-[11px] font-semibold text-muted">
                {selected.kind === "registered" ? "Has an account" : "Guest"}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {selected.orderCount === 0
                ? "No earlier orders"
                : `${selected.orderCount} earlier ${selected.orderCount === 1 ? "order" : "orders"}`}
              {selected.kind === "registered"
                ? " · this order is added to their account"
                : " · matched by their email / phone"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-hairline bg-panel px-2.5 py-1.5 text-xs font-semibold text-body-text hover:bg-canvas"
        >
          <X size={13} aria-hidden="true" />
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-heading">
          <UserRound size={15} aria-hidden="true" />
          Existing customer
        </span>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(ev) => {
              setQuery(ev.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(ev) => {
              if (ev.key === "Escape") setOpen(false);
            }}
            placeholder="Search by name, phone number or email…"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
          />
        </div>
        <span className="mt-1 block text-xs text-muted">
          Pick a returning customer to fill in their details. A new customer? Just fill the boxes below.
        </span>
      </label>

      {open && query.trim().length >= 2 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-hairline bg-panel py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-muted">No customer found — fill in the details below.</li>
          ) : (
            matches.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-canvas"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-heading">{c.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[c.phone, c.email, c.city].filter(Boolean).join(" · ") || "No contact details"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-muted">
                    <span className="block font-semibold">{c.kind === "registered" ? "Account" : "Guest"}</span>
                    {c.orderCount} {c.orderCount === 1 ? "order" : "orders"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
