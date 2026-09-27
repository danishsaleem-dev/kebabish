"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { upcomingBookableDays } from "@/lib/delivery-slots";
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
  const [reassignedNotice, setReassignedNotice] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const dayLabel = (dateKey: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(
      dateFromKey(dateKey)
    );

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
        const visible = data.slots.filter((s) => s.status === "available" || s.status === "full");
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

  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-charcoal-600">
        <Clock size={18} className="text-ember-600" />
        {t("deliveryTime")}
      </h2>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            onClick={() => setSelectedDate(day.dateKey)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
              selectedDate === day.dateKey
                ? "border-ember-600 bg-ember-600 text-cream-50"
                : "border-charcoal-600/15 bg-cream-50 text-ink/70 hover:border-ember-600/40"
            }`}
          >
            {dayLabel(day.dateKey)}
          </button>
        ))}
      </div>

      {reassignedNotice && (
        <p className="mt-3 rounded-xl bg-ember-600/10 px-3.5 py-2.5 text-sm text-ember-700">
          {t("slotReassigned")}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const active = value?.date === selectedDate && value.start === slot.start;
          const full = slot.status === "full";
          return (
            <button
              key={slot.start}
              type="button"
              disabled={full}
              onClick={() => onChange({ date: selectedDate, start: slot.start, end: slot.end })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                full
                  ? "cursor-not-allowed border-charcoal-600/10 bg-charcoal-600/5 text-ink/30 line-through"
                  : active
                    ? "border-ember-600 bg-ember-600 text-cream-50"
                    : "border-charcoal-600/15 bg-cream-50 text-ink/80 hover:border-ember-600/40"
              }`}
            >
              {slot.start}–{slot.end}
              {full && <span className="mt-0.5 block text-[11px] normal-case">{t("slotFullLabel")}</span>}
            </button>
          );
        })}
        {slots.length === 0 && (
          <p className="col-span-full text-sm text-ink/50">{t("slotNoneToday")}</p>
        )}
      </div>

      <input type="hidden" name="deliveryDate" value={value?.date ?? ""} />
      <input type="hidden" name="deliverySlotStart" value={value?.start ?? ""} />
      <input type="hidden" name="deliverySlotEnd" value={value?.end ?? ""} />
    </section>
  );
}
