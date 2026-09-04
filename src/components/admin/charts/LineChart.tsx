"use client";

import { useMemo, useRef, useState } from "react";
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
  const W = 760;
  const H = height;
  const PAD = { top: 16, right: 16, bottom: 34, left: 52 };

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
  const labelStep = Math.max(1, Math.ceil(n / 12));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / (W - PAD.left - PAD.right);
    const index = Math.round(ratio * (n - 1));
    setHover(index >= 0 && index < n ? index : null);
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[600px] touch-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
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
          className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-xl border border-hairline bg-panel p-3 shadow-lg"
          style={{
            left: `${((x(hover) - PAD.left) / (W - PAD.left - PAD.right)) * 82 + 12}%`,
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
