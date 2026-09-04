import { ArrowDown, ArrowUp } from "lucide-react";

/** The little green/red "+17%" pill next to a metric. */
export default function TrendBadge({ delta }: { delta: number }) {
  const up = delta >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
        up
          ? "bg-success-soft text-success"
          : "bg-danger-soft text-danger"
      }`}
    >
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}
