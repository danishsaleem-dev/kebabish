import { Package } from "lucide-react";
import type { StockLevel } from "@/lib/stock-status";

/**
 * A dish's stock health as a coloured pill — the same wording and colours in the items table, the
 * dish editor and the dashboard, so "amber" always means "running low":
 * green = comfortable, amber = at or below the warning level, red = out, grey = not tracked.
 * Staff see the number; customers never do.
 */
const STYLES: Record<StockLevel, string> = {
  ok: "bg-success-soft text-success",
  low: "bg-warn-soft text-warn",
  out: "bg-danger-soft text-danger",
  untracked: "bg-canvas text-muted",
};

export default function StockBadge({
  level,
  quantity,
  className = "",
}: {
  level: StockLevel;
  quantity?: number;
  className?: string;
}) {
  const label =
    level === "out"
      ? "Out of stock"
      : level === "low"
        ? `Low · ${quantity ?? ""} left`
        : level === "ok"
          ? `${quantity ?? ""} in stock`
          : "Not tracked";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[level]} ${className}`}
    >
      <Package size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
