import { CalendarClock, ChefHat, ChevronRight, MapPin, PackageCheck, Truck } from "lucide-react";

/**
 * Where one order is right now, as the kitchen has it. The four steps the
 * customer sees are fewer than the statuses staff use: "scheduled" is an
 * order accepted for a later day (it reads as Received until its day comes)
 * and "ready" is the kitchen's own optional step, which to the customer is
 * still being prepared.
 */
const ICONS = [PackageCheck, ChefHat, Truck, MapPin] as const;

export function trackerPosition(status: string): 0 | 1 | 2 | 3 {
  if (status === "delivered") return 3;
  if (status === "on_the_way") return 2;
  if (status === "preparing" || status === "ready") return 1;
  return 0;
}

export type TrackerLabels = {
  eyebrow: string;
  justPlaced: string;
  steps: [string, string, string, string];
  /** The line under the rail, already chosen for this order's status. */
  message: string;
  details: string;
};

export default function OrderTracker({
  reference,
  total,
  at,
  when,
  items,
  justPlaced,
  detailsHref,
  labels,
}: {
  reference: string;
  /** Formatted total, e.g. "€ 32,40". */
  total: string;
  at: 0 | 1 | 2 | 3;
  /** Formatted delivery window, or null when the order has none. */
  when: string | null;
  /** "2× Chicken Biryani, 1× Naan" — already joined. */
  items: string;
  justPlaced: boolean;
  detailsHref: string;
  labels: TrackerLabels;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ember-600/30 bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-ember-600 to-ember-400" />

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ember-700">
              {labels.eyebrow}
              {justPlaced && (
                <span className="rounded-full bg-ember-600 px-2 py-0.5 text-[0.65rem] font-bold tracking-normal text-cream-50">
                  {labels.justPlaced}
                </span>
              )}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-heading">{reference}</h2>
          </div>
          <p className="font-display text-lg font-semibold tabular-nums text-heading">{total}</p>
        </div>

        {/* The rail sits behind the nodes; the filled part is as wide as the
            steps completed, so the two can never disagree. */}
        <div className="relative mt-6">
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-5 h-1 -translate-y-1/2 rounded-full bg-canvas"
          />
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] top-5 h-1 -translate-y-1/2 rounded-full bg-ember-600 transition-[width] duration-500"
            style={{ width: `calc(${(at / 3) * 75}%)` }}
          />
          <ol className="relative grid grid-cols-4 gap-1" aria-label={labels.eyebrow}>
            {labels.steps.map((step, i) => {
              const done = i <= at;
              const now = i === at;
              const Icon = ICONS[i];
              return (
                <li key={step} className="text-center" aria-current={now ? "step" : undefined}>
                  <span
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-panel transition-colors ${
                      done ? "bg-ember-600 text-cream-50" : "bg-canvas text-faint"
                    } ${now ? "ring-4 ring-ember-600/20" : ""}`}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span
                    className={`mt-2 block text-[0.6875rem] leading-tight sm:text-xs ${
                      done ? "font-semibold text-heading" : "text-faint"
                    }`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="mt-5 text-sm font-medium text-body-text">{labels.message}</p>

        {when && (
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm font-semibold text-heading">
            <CalendarClock size={15} aria-hidden="true" className="shrink-0 text-ember-600" />
            {when}
          </p>
        )}

        <p className="mt-2.5 text-sm text-muted">{items}</p>

        <a
          href={detailsHref}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ember-700 hover:text-ember-600"
        >
          {labels.details}
          <ChevronRight size={15} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
