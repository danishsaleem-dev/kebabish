"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import {
  amsterdamDateAhead,
  amsterdamNow,
  upcomingBookableDays,
} from "@/lib/delivery-slots";
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

/** "YYYY-MM-DD" -> a Date built from local parts, never through a UTC parse — a plain calendar date shouldn't drift a day depending on the visitor's own timezone offset. */
function dateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function DeliverySlotPicker({
  hours,
  value,
  onChange,
}: {
  hours: StoredSettings["hours"];
  value: DeliverySlotValue | null;
  onChange: (slot: DeliverySlotValue) => void;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();

  const days = useMemo(() => upcomingBookableDays(hours), [hours]);
  const [selectedDate, setSelectedDate] = useState(days[0]?.dateKey ?? "");
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassignedNotice, setReassignedNotice] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // "Today"/"Tomorrow" read better than a bare weekday on the two days most
  // orders land on; anything further out gets its weekday instead.
  const todayKey = amsterdamNow().dateKey;
  const tomorrowKey = amsterdamDateAhead(1).dateKey;

  const weekdayLabel = (dateKey: string) => {
    if (dateKey === todayKey) return t("today");
    if (dateKey === tomorrowKey) return t("tomorrow");
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      dateFromKey(dateKey)
    );
  };

  const dateLabel = (dateKey: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
      dateFromKey(dateKey)
    );

  useEffect(() => {
    let cancelled = false;

    // Clear immediately on a date switch, or the previous day's slots sit
    // there looking selectable until the new ones land.
    setSlots([]);
    setLoading(true);

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
        setSlots(visible);

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
        // Next poll (or a date switch) tries again — nothing actionable here.
      } finally {
        if (!cancelled) setLoading(false);
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

  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-charcoal-600">
        <Clock size={18} className="text-ember-600" />
        {t("deliveryTime")}
      </h2>
      <p className="mt-1 text-sm text-ink/55">{t("deliveryTimeHint")}</p>

      {/* A fixed 4-wide grid rather than a scroll strip: equal-width chips,
          nothing clipped mid-word, no native scrollbar underneath, and 7
          days wrap onto two tidy rows. Stays at 4 on desktop too — the
          checkout form column is narrow enough that 7 across would squeeze
          "Vandaag" into an ellipsis. */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {days.map((day) => {
          const active = selectedDate === day.dateKey;
          return (
            <button
              key={day.dateKey}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedDate(day.dateKey)}
              className={`rounded-xl border px-1.5 py-2.5 text-center transition-colors ${
                active
                  ? "border-ember-600 bg-ember-600 text-cream-50 shadow-sm"
                  : "border-charcoal-600/15 bg-cream-50 text-ink/75 hover:border-ember-600/50 hover:bg-ember-600/5"
              }`}
            >
              <span className="block truncate text-[13px] font-semibold capitalize leading-tight">
                {weekdayLabel(day.dateKey)}
              </span>
              <span
                className={`mt-0.5 block truncate text-[11px] leading-tight ${
                  active ? "text-cream-100/80" : "text-ink/50"
                }`}
              >
                {dateLabel(day.dateKey)}
              </span>
            </button>
          );
        })}
      </div>

      {reassignedNotice && (
        <p className="mt-3 rounded-xl bg-ember-600/10 px-3.5 py-2.5 text-sm text-ember-700">
          {t("slotReassigned")}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {loading && slots.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[3.25rem] animate-pulse rounded-xl bg-charcoal-600/5"
                aria-hidden="true"
              />
            ))
          : slots.map((slot) => {
              const active = value?.date === selectedDate && value.start === slot.start;
              const full = slot.status === "full";
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={full}
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ date: selectedDate, start: slot.start, end: slot.end })
                  }
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
            })}
      </div>

      {showEmpty && (
        <p className="mt-3 rounded-xl border border-charcoal-600/10 bg-cream-50 px-4 py-3 text-sm text-ink/55">
          {t("slotNoneToday")}
        </p>
      )}

      {selectedSlot && (
        <p className="mt-3 text-sm text-ink/60">
          {t("slotChosen", { start: selectedSlot.start, end: selectedSlot.end })}
        </p>
      )}

      <input type="hidden" name="deliveryDate" value={value?.date ?? ""} />
      <input type="hidden" name="deliverySlotStart" value={value?.start ?? ""} />
      <input type="hidden" name="deliverySlotEnd" value={value?.end ?? ""} />
    </section>
  );
}
