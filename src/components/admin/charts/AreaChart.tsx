"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useAnimatedNumbers } from "@/components/admin/charts/useAnimated";

/** Midpoint-cubic smoothing — soft curve without overshooting the data. */
function smooth(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

export default function AreaChart({
  labels,
  values,
  color = "#a95026",
  height = 260,
  valueFormat = (v: number) => Math.round(v).toLocaleString("en-US"),
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
  valueFormat?: (value: number) => string;
}) {
  const gradientId = useId();
  const W = 620;
  const H = height;
  const PAD = { top: 16, right: 14, bottom: 32, left: 52 };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const animated = useAnimatedNumbers(values);

  const max = useMemo(() => {
    const peak = Math.max(1, ...values);
    const mag = Math.pow(10, Math.floor(Math.log10(peak)));
    return Math.ceil(peak / mag) * mag;
  }, [values]);

  const n = labels.length;
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);

  const coords = animated.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(coords);
  const area = `${line} L ${x(n - 1)} ${H - PAD.bottom} L ${x(0)} ${H - PAD.bottom} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const labelStep = Math.max(1, Math.ceil(n / 6));

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
          className="h-auto w-full min-w-[440px] touch-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="Area chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={W - PAD.right}
                y2={y(t)}
                stroke="#e9ebef"
                strokeWidth="1"
                strokeDasharray="4 5"
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

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

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

          {hover !== null && (
            <>
              <line
                x1={x(hover)}
                y1={PAD.top}
                x2={x(hover)}
                y2={H - PAD.bottom}
                stroke={color}
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <circle
                cx={x(hover)}
                cy={y(animated[hover] ?? 0)}
                r="5"
                fill="#fff"
                stroke={color}
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl border border-hairline bg-panel px-3 py-2 shadow-lg"
          style={{
            left: `${((x(hover) - PAD.left) / (W - PAD.left - PAD.right)) * 82 + 12}%`,
          }}
        >
          <p className="text-xs text-muted">{labels[hover]}</p>
          <p className="font-display text-sm font-semibold text-heading">
            {valueFormat(values[hover] ?? 0)}
          </p>
        </div>
      )}
    </div>
  );
}
