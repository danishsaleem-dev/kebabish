import Link from "next/link";
import { PackageX } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import StockCell from "@/components/admin/StockCell";
import type { StockWatch } from "@/lib/stock";

/**
 * Dishes that are out or nearly out, at the top of the dashboard — with the stock pill right there to
 * add a batch without opening the dish. Shows nothing when everything is comfortable.
 */
export default function StockAlertsCard({ alerts }: { alerts: StockWatch[] }) {
  if (alerts.length === 0) return null;
  const out = alerts.filter((a) => a.level === "out").length;

  return (
    <Card className={`mb-4 border-l-4 sm:mb-6 ${out > 0 ? "border-l-danger" : "border-l-warn"}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            out > 0 ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"
          }`}
        >
          <PackageX size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-heading">
            {out > 0
              ? `${out} ${out === 1 ? "dish is" : "dishes are"} out of stock`
              : `${alerts.length} ${alerts.length === 1 ? "dish is" : "dishes are"} running low`}
            {out > 0 && alerts.length > out && ` · ${alerts.length - out} running low`}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Out-of-stock dishes still show on the website as sold out, and customers can request them.
          </p>

          <ul className="mt-3 divide-y divide-hairline">
            {alerts.map((a) => (
              <li key={a.slug} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link
                  href={`/admin/menu/items/${a.slug}/edit`}
                  className="text-sm font-semibold text-heading hover:text-ember-600"
                >
                  {a.name}
                </Link>
                <StockCell
                  item={{ slug: a.slug, name: a.name }}
                  stock={{ quantity: a.quantity, lowThreshold: a.lowThreshold }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
