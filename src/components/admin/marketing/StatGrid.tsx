import Card from "@/components/admin/ui/Card";

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

/**
 * The divided row of figures every admin screen opens with — the same block
 * the Customers and Orders pages use, pulled out because three screens in
 * this section want it.
 *
 * A figure that could not be read is shown as "—", never as 0. "Nobody opened
 * it" and "Brevo didn't answer" are different things and the dashboard must
 * not say the first when it means the second.
 */
export default function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <Card padded={false}>
      <div className="grid divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1.5 font-display text-2xl font-semibold text-heading">{stat.value}</p>
            {stat.hint && <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** A count, or "—" when it could not be read. */
export function figure(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-GB");
}

/** A percentage, or "—". */
export function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
