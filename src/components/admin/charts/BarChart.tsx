"use client";

import { useState } from "react";
import { useAnimatedNumbers } from "@/components/admin/charts/useAnimated";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Horizontal bars — better than vertical for category names that need reading
 * (town names, dish names), and the labels never collide.
 */
export function HorizontalBars({
  data,
  color = "#a95026",
  valueFormat = (v: number) => Math.round(v).toLocaleString("en-US"),
}: {
  data: BarDatum[];
  color?: string;
  valueFormat?: (value: number) => string;
}) {
  const animated = useAnimatedNumbers(data.map((d) => d.value));
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="space-y-3">
      {data.map((datum, i) => (
        <li key={datum.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-body-text">{datum.label}</span>
            <span className="shrink-0 font-display text-sm font-semibold text-heading">
              {valueFormat(datum.value)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full"
              style={{
                width: `${((animated[i] ?? 0) / max) * 100}%`,
                background: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical column chart with hover readout — used for the hourly rush. */
export function ColumnChart({
  data,
  color = "#a95026",
  height = 220,
  valueFormat = (v: number) => Math.round(v).toLocaleString("en-US"),
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  valueFormat?: (value: number) => string;
}) {
  const animated = useAnimatedNumbers(data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div
        className="flex items-end gap-1.5 sm:gap-2"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((datum, i) => {
          const pct = ((animated[i] ?? 0) / max) * 100;
          const active = hover === i;

          return (
            <div
              key={datum.label}
              className="group flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
            >
              <span
                className={`mb-1 text-center text-[10px] font-semibold transition-opacity ${
                  active ? "opacity-100 text-heading" : "opacity-0"
                }`}
              >
                {valueFormat(datum.value)}
              </span>
              <div
                className="w-full rounded-t-md transition-[filter,opacity]"
                style={{
                  height: `${pct}%`,
                  background: color,
                  opacity: hover === null || active ? 1 : 0.45,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {data.map((datum, i) => (
          <span
            key={datum.label}
            className={`flex-1 text-center text-[10px] ${
              hover === i ? "font-semibold text-heading" : "text-faint"
            }`}
          >
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
