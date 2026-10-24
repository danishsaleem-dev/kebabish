"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  compareMonths,
  monthGrid,
  monthLabel,
  monthOfKey,
  weekdayHeadings,
} from "@/lib/calendar";
import {
  PRESETS,
  describeRange,
  matchPreset,
  normaliseRange,
  presetRange,
  type ReportRange,
} from "@/lib/admin/report-range";

/**
 * Picking the days a report covers: the usual presets, plus a real calendar for anything else
 * — click the first day, click the last. The month grid is the same pure maths the checkout
 * day picker uses (`src/lib/calendar.ts`), so the two can't drift apart.
 *
 * A future day is never selectable: there are no orders there, and a range running into next
 * month would silently flatten every average.
 */
export default function DateRangePicker({
  value,
  today,
  onChange,
}: {
  value: ReportRange;
  /** Today's Amsterdam date key — passed in so the server and the first paint agree. */
  today: string;
  onChange: (range: ReportRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOfKey(value.to));
  /** The first click of a new range; null when we're waiting for a first click. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const headings = useMemo(() => weekdayHeadings("en-GB", "short"), []);
  const lastMonth = useMemo(() => monthOfKey(today), [today]);
  const activePreset = matchPreset(value, today);

  // Clicking away closes the calendar; it's a popover, not a mode.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Keep the popover on screen. It is anchored to the right of its button, which is fine until
   * the chips wrap and the button ends up near the left edge — then 20rem of calendar hangs off
   * the side. Nudged with a transform rather than state, so this costs no extra render.
   */
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    el.style.transform = "";
    const box = el.getBoundingClientRect();
    const margin = 8;
    const shift =
      box.left < margin
        ? margin - box.left
        : box.right > window.innerWidth - margin
          ? window.innerWidth - margin - box.right
          : 0;
    if (shift !== 0) el.style.transform = `translateX(${Math.round(shift)}px)`;
  }, [open, view]);

  const pick = (dateKey: string) => {
    if (anchor === null) {
      setAnchor(dateKey);
      setHovered(dateKey);
      return;
    }
    onChange(normaliseRange(anchor, dateKey));
    setAnchor(null);
    setHovered(null);
    setOpen(false);
  };

  // While picking, the highlight follows the pointer so the range being drawn is visible.
  const preview = anchor !== null ? normaliseRange(anchor, hovered ?? anchor) : value;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onChange(presetRange(preset.id, today))}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            activePreset === preset.id
              ? "border-ember-600 bg-ember-600 text-cream-50"
              : "border-hairline text-body-text hover:bg-canvas"
          }`}
        >
          {preset.label}
        </button>
      ))}

      <div className="relative" ref={boxRef}>
        <button
          type="button"
          onClick={() => {
            setView(monthOfKey(value.to));
            setAnchor(null);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            activePreset === null
              ? "border-ember-600 bg-ember-600 text-cream-50"
              : "border-hairline text-body-text hover:bg-canvas"
          }`}
        >
          <CalendarDays size={15} />
          {activePreset === null ? describeRange(value) : "Pick dates"}
        </button>

        {open && (
          <div
            ref={popRef}
            className="absolute right-0 z-30 mt-2 w-[20rem] max-w-[calc(100vw-1rem)] rounded-2xl border border-hairline bg-panel p-4 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setView(addMonths(view.year, view.month, -1))}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
              >
                <ChevronLeft size={17} />
              </button>
              <p aria-live="polite" className="font-display text-sm font-semibold text-heading">
                {monthLabel(view.year, view.month, "en-GB")}
              </p>
              <button
                type="button"
                onClick={() => setView(addMonths(view.year, view.month, 1))}
                disabled={compareMonths(view, lastMonth) >= 0}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-0.5 text-center">
              {headings.map((h) => (
                <span key={h} className="pb-1 text-[11px] font-semibold uppercase text-faint">
                  {h}
                </span>
              ))}

              {weeks.flat().map((cell) => {
                const future = cell.dateKey > today;
                const inRange = cell.dateKey >= preview.from && cell.dateKey <= preview.to;
                const isEdge = cell.dateKey === preview.from || cell.dateKey === preview.to;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={future}
                    aria-pressed={inRange}
                    onClick={() => pick(cell.dateKey)}
                    onMouseEnter={() => setHovered(cell.dateKey)}
                    className={`flex h-9 items-center justify-center text-sm font-medium tabular-nums transition-colors ${
                      isEdge
                        ? "rounded-lg bg-ember-600 font-semibold text-cream-50"
                        : inRange
                          ? "bg-ember-600/12 text-heading"
                          : future
                            ? "cursor-not-allowed text-faint/50"
                            : cell.inMonth
                              ? "rounded-lg text-body-text hover:bg-canvas"
                              : "rounded-lg text-faint hover:bg-canvas"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted">
              {anchor === null
                ? "Click the first day, then the last."
                : "Now click the last day of the range."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
