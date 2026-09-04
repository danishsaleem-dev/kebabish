"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A real select menu — keyboard reachable, closes on outside click and Escape.
 * Replaces the placeholder pills the dashboard shipped with.
 */
export default function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  bordered = true,
  align = "right",
}: {
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  bordered?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-canvas ${
          bordered ? "border border-hairline bg-panel" : ""
        }`}
      >
        {label && <span className="text-muted">{label}:</span>}
        <span className="font-semibold text-heading">
          {current?.label ?? value}
        </span>
        <ChevronDown
          size={15}
          className={`text-faint transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute z-30 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-hairline bg-panel py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                  option.value === value
                    ? "font-semibold text-heading"
                    : "text-body-text"
                }`}
              >
                {option.label}
                {option.value === value && (
                  <Check size={15} className="shrink-0 text-ember-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
