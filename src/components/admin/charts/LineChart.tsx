"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimatedNumbers } from "@/components/admin/charts/useAnimated";

export interface LineSeries {
  label: string;
  values: number[];
  color: string;
  dashed?: boolean;
}

/**
 * Animated multi-series line chart with a hover crosshair and tooltip.
 *
 * Values are tweened (see useAnimatedNumbers), so changing a filter morphs the
 * line into its new shape instead of snapping.
 */
export default function LineChart({
  labels,
  series,
  height = 280,
  valueFormat = (v: number) => Math.round(v).toLocaleString("en-US"),
  yTicks = 5,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  valueFormat?: (value: number) => string;
  yTicks?: number;
}) {
  // The drawing is as wide as the space it is given, so its text is always real size. It used
  // to be a fixed 760-unit canvas scaled down to fit: on a phone that shrank the axis labels to
  // about 5px, and a 600px minimum then made the chart scroll sideways instead. 760 is only the
  // first guess, before the container has been measured (and what the server renders).
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const W = Math.max(width, 240);
  const compact = W < 520;
  const H = compact ? Math.min(height, 240) : height;
  const PAD = compact
    ? { top: 14, right: 12, bottom: 30, left: 40 }
    : { top: 16, right: 16, bottom: 34, left: 52 };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Every series is tweened through a single hook call — flattened here and
  // split back below. Calling the hook per series would break hook ordering
  // the moment a chart renders a different number of series.
  const animatedFlat = useAnimatedNumbers(series.flatMap((s) => s.values));
  const animated = useMemo(() => {
    const lengths = series.map((s) => s.values.length);
    return series.map((s, i) => {
      const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
      const values = animatedFlat.slice(start, start + s.values.length);
      return { ...s, values: values.length ? values : s.values };
    });
  }, [series, animatedFlat]);

  const max = useMemo(() => {
    const peak = Math.max(1, ...series.flatMap((s) => s.values));
    // Round up to a clean tick so the axis reads nicely.
    const mag = Math.pow(10, Math.floor(Math.log10(peak)));
    return Math.ceil(peak / mag) * mag;
  }, [series]);

  const n = labels.length;
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i);
  // One x label per ~52px of chart, never more than 12, so they never run into each other.
  const fits = Math.max(2, Math.min(12, Math.floor((W - PAD.left - PAD.right) / 52)));
  const labelStep = Math.max(1, Math.ceil(n / fits));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / (W - PAD.left - PAD.right);
    const index = Math.round(ratio * (n - 1));
    // The nearest point, even when the touch lands in the margin beside the first or last one:
    // a fingertip is far less precise than a cursor.
    setHover(n > 0 ? Math.min(Math.max(index, 0), n - 1) : null);
  };

  return (
    <div ref={wrapRef} className="relative min-w-0">
      {/* Which line is which. Hover tells you on a desktop; a phone has no hover. */}
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-0.5 w-4 rounded-full"
                style={
                  s.dashed
                    ? { background: `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` }
                    : { background: s.color }
                }
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          // pan-y: a finger can still scroll the page, while sideways movement scrubs the chart.
          className="block h-auto w-full max-w-full touch-pan-y"
          onPointerDown={onMove}
          onPointerMove={onMove}
          onPointerLeave={(e) => {
            // A finger lifting is not "leaving": the reading stays until the next touch.
            if (e.pointerType === "mouse") setHover(null);
          }}
          role="img"
          aria-label={`Line chart: ${series.map((s) => s.label).join(", ")}`}
        >
          <defs>
            {animated.map((s, i) => (
              <linearGradient key={i} id={`line-glow-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={W - PAD.right}
                y2={y(t)}
                stroke="#eef0f3"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#98a2b3"
              >
                {valueFormat(t)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {labels.map((label, i) =>
            i % labelStep === 0 ? (
              <text
                key={label + i}
                x={x(i)}
                y={H - PAD.bottom + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#98a2b3"
              >
                {label}
              </text>
            ) : null
          )}

          {/* soft fill under the primary series */}
          {animated.slice(0, 1).map((s, i) => (
            <path
              key={`fill-${i}`}
              d={`${s.values.map((v, j) => `${j === 0 ? "M" : "L"} ${x(j)} ${y(v)}`).join(" ")} L ${x(n - 1)} ${H - PAD.bottom} L ${x(0)} ${H - PAD.bottom} Z`}
              fill={`url(#line-glow-${i})`}
            />
          ))}

          {/* lines */}
          {animated.map((s, i) => (
            <path
              key={`line-${i}`}
              d={s.values
                .map((v, j) => `${j === 0 ? "M" : "L"} ${x(j)} ${y(v)}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.75 : 2.5}
              strokeDasharray={s.dashed ? "5 5" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* crosshair */}
          {hover !== null && (
            <>
              <line
                x1={x(hover)}
                y1={PAD.top}
                x2={x(hover)}
                y2={H - PAD.bottom}
                stroke="#101828"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              {animated.map((s, i) => (
                <circle
                  key={`dot-${i}`}
                  cx={x(hover)}
                  cy={y(s.values[hover] ?? 0)}
                  r="4.5"
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth="2.5"
                />
              ))}
            </>
          )}
        </svg>
      </div>

      {/* tooltip — HTML so it can't be clipped by the SVG viewBox */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 w-40 -translate-x-1/2 rounded-xl border border-hairline bg-panel p-3 shadow-lg"
          style={{
            // Centred on the point but never past either edge, so the first and last buckets
            // are not cut off on a narrow screen.
            left: Math.min(Math.max(x(hover), 84), Math.max(W - 84, 84)),
            // Clear of the legend row when there is one.
            top: series.length > 1 ? 32 : 8,
          }}
        >
          <p className="text-xs font-semibold text-heading">{labels[hover]}</p>
          <ul className="mt-1.5 space-y-1">
            {series.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <span className="flex items-center gap-1.5 text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span className="font-semibold text-heading">
                  {valueFormat(s.values[hover] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
