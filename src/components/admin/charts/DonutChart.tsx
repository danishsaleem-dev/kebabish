"use client";

import { useState } from "react";
import { useAnimatedNumbers } from "@/components/admin/charts/useAnimated";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Animated donut with a hoverable legend and a centre readout. */
export default function DonutChart({
  slices,
  centreLabel,
  size = 180,
}: {
  slices: DonutSlice[];
  centreLabel?: string;
  size?: number;
}) {
  const animated = useAnimatedNumbers(slices.map((s) => s.value));
  const [hover, setHover] = useState<number | null>(null);

  const total = Math.max(1, animated.reduce((a, b) => a + b, 0));
  const R = 60;
  const C = 2 * Math.PI * R;

  const arcs = animated.map((value, i) => ({
    length: (value / total) * C,
    // Cumulative start of this slice — computed rather than accumulated in a
    // mutable outer variable, which the React compiler rightly rejects.
    offset: (animated.slice(0, i).reduce((a, b) => a + b, 0) / total) * C,
    index: i,
  }));

  const active = hover !== null ? slices[hover] : null;
  const activePct =
    hover !== null ? Math.round((slices[hover].value / Math.max(1, slices.reduce((a, b) => a + b.value, 0))) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#eef0f3" strokeWidth="18" />
          {arcs.map((arc) => (
            <circle
              key={arc.index}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={slices[arc.index].color}
              strokeWidth={hover === arc.index ? 22 : 18}
              strokeDasharray={`${arc.length} ${C}`}
              strokeDashoffset={-arc.offset}
              className="transition-[stroke-width] duration-200"
              opacity={hover === null || hover === arc.index ? 1 : 0.4}
              onMouseEnter={() => setHover(arc.index)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-2xl font-semibold text-heading">
            {activePct !== null ? `${activePct}%` : centreLabel}
          </span>
          <span className="max-w-24 text-[11px] leading-tight text-muted">
            {active ? active.label : "Total"}
          </span>
        </div>
      </div>

      <ul className="min-w-40 flex-1 space-y-2">
        {slices.map((slice, i) => (
          <li
            key={slice.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition-colors ${
              hover === i ? "bg-canvas" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="truncate text-body-text">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-heading">
              {slice.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
