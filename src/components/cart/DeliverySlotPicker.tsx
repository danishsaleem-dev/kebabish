"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  amsterdamDateAhead,
  amsterdamNow,
  upcomingBookableDays,
} from "@/lib/delivery-slots";
import {
  addMonths,
  compareMonths,
  dateFromKey,
  monthGrid,
  monthLabel,
  monthOfKey,
  weekdayHeadings,
} from "@/lib/calendar";
import type { StoredSettings } from "@/lib/admin/store/types";

export interface DeliverySlotValue {
  date: string;
  start: string;
  end: string;
}

interface SlotAvailability {
  start: string;
  end: string;
  status: "available" | "full" | "disabled" | "past";
}

const POLL_MS = 20_000;
/** Slots starting before this read as the afternoon, the rest as the evening. */
const EVENING_FROM = "17:00";

/**
 * Picking when the order arrives: **a real calendar** for the day, then the delivery windows for
 * that day. It replaced a row of seven day chips over a wall of time buttons, which customers
 * found confusing — a month grid is the control everyone already knows, and it makes "which days
 * do they even deliver?" answerable at a glance (a closed day simply isn't selectable).
 *
 * There is deliberately **no "as soon as possible"**: every order books a real window, so the
 * customer always leaves knowing when the food arrives (Danish's call).
 *
 * Availability still comes from the same 20-second poll of `/api/delivery-slots`, and a slot that
 * fills up while someone is deciding still reassigns them to the next one with a notice.
 */
export default function DeliverySlotPicker({
  hours,
  windowDays,
  value,
  onChange,
}: {
  hours: StoredSettings["hours"];
  windowDays: number;
  value: DeliverySlotValue | null;
  onChange: (slot: DeliverySlotValue) => void;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();

  const days = useMemo(() => upcomingBookableDays(hours, windowDays), [hours, windowDays]);
  const bookable = useMemo(() => new Set(days.map((d) => d.dateKey)), [days]);
  const [selectedDate, setSelectedDate] = useState(days[0]?.dateKey ?? "");
  // Slots are stored *with the date they describe*, so switching day needs no clearing step: a
  // stale answer simply stops matching, which is also what "still loading" means here. Clearing
  // state from the effect body instead would be a cascading render the lint rule rightly refuses.
  const [answer, setAnswer] = useState<{ date: string; slots: SlotAvailability[] } | null>(null);
  const [reassignedNotice, setReassignedNotice] = useState(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const slots = answer?.date === selectedDate ? answer.slots : [];
  const loading = answer?.date !== selectedDate;

  // The booking window is short (a week by default), so the calendar only ever spans one or two
  // months — the arrows are capped to those, rather than letting someone wander into 2029.
  const firstMonth = useMemo(
    () => monthOfKey(days[0]?.dateKey ?? amsterdamNow().dateKey),
    [days]
  );
  const lastMonth = useMemo(
    () => monthOfKey(days[days.length - 1]?.dateKey ?? amsterdamNow().dateKey),
    [days]
  );
  const [view, setView] = useState(firstMonth);

  const todayKey = amsterdamNow().dateKey;
  const tomorrowKey = amsterdamDateAhead(1).dateKey;
  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const headings = useMemo(() => weekdayHeadings(locale, "short"), [locale]);

  const canGoBack = compareMonths(view, firstMonth) > 0;
  const canGoForward = compareMonths(view, lastMonth) < 0;

  const relativeDay = (dateKey: string) =>
    dateKey === todayKey ? t("today") : dateKey === tomorrowKey ? t("tomorrow") : null;

  const dayTitle = (dateKey: string) =>
    relativeDay(dateKey) ??
    new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
      dateFromKey(dateKey)
    );

  /**
   * The same label, fit to sit inside a sentence. Only "Vandaag"/"Morgen" are lowercased: they come
   * from the message file capitalised, and Dutch writes them lowercase mid-sentence. A weekday is
   * left exactly as Intl gives it, which is already right in both languages ("zondag", "Sunday").
   */
  const dayTitleInline = (dateKey: string) => {
    const rel = relativeDay(dateKey);
    return rel ? rel.charAt(0).toLowerCase() + rel.slice(1) : dayTitle(dateKey);
  };

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!selectedDate) return;
      try {
        const res = await fetch(`/api/delivery-slots?date=${selectedDate}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { slots: SlotAvailability[] };
        const visible = data.slots.filter(
          (s) => s.status === "available" || s.status === "full"
        );
        if (cancelled) return;
        setAnswer({ date: selectedDate, slots: visible });

        const current = valueRef.current;
        const currentStillGood =
          current?.date === selectedDate &&
          visible.some((s) => s.start === current.start && s.status === "available");

        if (!currentStillGood) {
          const next = visible.find((s) => s.status === "available");
          setReassignedNotice(Boolean(current && current.date === selectedDate));
          if (next) onChange({ date: selectedDate, start: next.start, end: next.end });
        } else {
          setReassignedNotice(false);
        }
      } catch {
        // Record the day as having nothing, so the customer gets the "no windows" line rather
        // than a skeleton that pulses for ever; the next poll (20s) still tries again.
        if (!cancelled)
          setAnswer((prev) =>
            prev?.date === selectedDate ? prev : { date: selectedDate, slots: [] }
          );
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  if (days.length === 0) return null;

  const selectedSlot = value?.date === selectedDate ? value : null;
  const showEmpty = !loading && slots.length === 0;
  const afternoon = slots.filter((s) => s.start < EVENING_FROM);
  const evening = slots.filter((s) => s.start >= EVENING_FROM);

  const slotButton = (slot: SlotAvailability) => {
    const active = value?.date === selectedDate && value.start === slot.start;
    const full = slot.status === "full";
    return (
      <button
        key={slot.start}
        type="button"
        disabled={full}
        aria-pressed={active}
        onClick={() => onChange({ date: selectedDate, start: slot.start, end: slot.end })}
        className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border px-2 text-sm font-medium transition-colors ${
          full
            ? "cursor-not-allowed border-charcoal-600/10 bg-charcoal-600/5 text-ink/35"
            : active
              ? "border-ember-600 bg-ember-600 text-cream-50 shadow-sm"
              : "border-charcoal-600/15 bg-cream-50 text-ink/80 hover:border-ember-600/50 hover:bg-ember-600/5"
        }`}
      >
        <span className="tabular-nums">
          {slot.start}–{slot.end}
        </span>
        {full && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {t("slotFullLabel")}
          </span>
        )}
      </button>
    );
  };

  const group = (label: string, list: SlotAvailability[]) =>
    list.length === 0 ? null : (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{list.map(slotButton)}</div>
      </div>
    );

  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-charcoal-600">
        <Clock size={18} className="text-ember-600" />
        {t("deliveryTime")}
      </h2>
      <p className="mt-1 text-sm text-ink/55">{t("deliveryTimeHint")}</p>

      {/* ---- step 1: the day ---- */}
      <div className="mt-4 rounded-2xl border border-charcoal-600/15 bg-cream-50 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setView(addMonths(view.year, view.month, -1))}
            disabled={!canGoBack}
            aria-label={t("slotPrevMonth")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-ember-600/10 hover:text-ember-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <p aria-live="polite" className="font-display text-base font-semibold text-charcoal-600">
            {monthLabel(view.year, view.month, locale)}
          </p>
          <button
            type="button"
            onClick={() => setView(addMonths(view.year, view.month, 1))}
            disabled={!canGoForward}
            aria-label={t("slotNextMonth")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-ember-600/10 hover:text-ember-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {headings.map((h) => (
            <span
              key={h}
              className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/40"
            >
              {h}
            </span>
          ))}

          {weeks.flat().map((cell) => {
            const open = bookable.has(cell.dateKey);
            const active = selectedDate === cell.dateKey;
            const isToday = cell.dateKey === todayKey;
            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={!open}
                aria-pressed={active}
                aria-label={dayTitle(cell.dateKey)}
                onClick={() => setSelectedDate(cell.dateKey)}
                className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                  active
                    ? "bg-ember-600 text-cream-50 shadow-sm"
                    : open
                      ? "text-charcoal-600 hover:bg-ember-600/10 hover:text-ember-700"
                      : `cursor-not-allowed ${cell.inMonth ? "text-ink/25" : "text-ink/10"}`
                } ${isToday && !active ? "ring-1 ring-inset ring-ember-600/40" : ""}`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/45">
          <CalendarDays size={13} className="shrink-0" />
          {t("slotDaysHint")}
        </p>
      </div>

      {/* ---- step 2: the window ---- */}
      <p className="mt-4 text-sm font-semibold text-charcoal-600">
        {t("slotPickTime", { day: dayTitleInline(selectedDate) })}
      </p>

      {reassignedNotice && (
        <p className="mt-2 rounded-xl bg-ember-600/10 px-3.5 py-2.5 text-sm text-ember-700">
          {t("slotReassigned")}
        </p>
      )}

      <div className="mt-3 space-y-4">
        {loading && slots.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[3.25rem] animate-pulse rounded-xl bg-charcoal-600/5"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <>
            {group(t("slotGroupAfternoon"), afternoon)}
            {group(t("slotGroupEvening"), evening)}
          </>
        )}
      </div>

      {showEmpty && (
        <p className="mt-3 rounded-xl border border-charcoal-600/10 bg-cream-50 px-4 py-3 text-sm text-ink/55">
          {t("slotNoneToday")}
        </p>
      )}

      {selectedSlot && (
        <p className="mt-3 rounded-xl bg-ember-600/10 px-3.5 py-2.5 text-sm font-semibold text-ember-700">
          {t("slotChosenOn", {
            day: dayTitleInline(selectedSlot.date),
            start: selectedSlot.start,
            end: selectedSlot.end,
          })}
        </p>
      )}

      <input type="hidden" name="deliveryDate" value={value?.date ?? ""} />
      <input type="hidden" name="deliverySlotStart" value={value?.start ?? ""} />
      <input type="hidden" name="deliverySlotEnd" value={value?.end ?? ""} />
    </section>
  );
}
