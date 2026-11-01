import Link from "next/link";
import { Gift } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { formatEuro, fromCents } from "@/lib/money";
import { progressToReward, valueOfPoints } from "@/lib/rewards-math";
import type { CustomerRewards } from "@/lib/rewards";

const n = (value: number) => value.toLocaleString("en-GB");

/** The customer's Kebabish Punten: balance, how close the next reward is, and the last movements. */
export default function RewardsCard({ rewards }: { rewards: CustomerRewards }) {
  const { config, available, held, pending, history } = rewards;
  const progress = progressToReward(available, config);
  const worth = valueOfPoints(available, config);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-heading">Kebabish Punten</h2>
          <p className="mt-0.5 text-sm text-muted">
            {n(config.pointsPerEuro)} points for every €1 of food. {n(config.redeemStepPoints)} points ={" "}
            {formatEuro(fromCents(config.redeemStepCents))} off your next order.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-semibold tabular-nums text-heading">{n(available)}</p>
          <p className="text-xs text-muted">
            {worth > 0 ? `worth ${formatEuro(fromCents(worth))}` : "points"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-hairline"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={config.redeemStepPoints}
          aria-valuenow={Math.min(available, config.redeemStepPoints)}
          aria-label="Progress to your next reward"
        >
          <div
            className="h-full rounded-full bg-ember-600"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-body-text">
          {progress.canRedeem ? (
            <>
              You can use your points at checkout.{" "}
              <Link href="/menu" className="font-semibold text-ember-700 underline underline-offset-2">
                Order now
              </Link>
            </>
          ) : (
            <>
              {n(progress.toGo)} more points for {formatEuro(fromCents(config.redeemStepCents))} off.
            </>
          )}
        </p>
        {pending > 0 && (
          <p className="mt-1 text-xs text-muted">
            +{n(pending)} points on the way once your open orders are delivered.
          </p>
        )}
        {held > 0 && (
          <p className="mt-1 text-xs text-muted">{n(held)} points are set aside for an order still waiting for payment.</p>
        )}
      </div>

      {history.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline text-sm">
          {history.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-body-text">{row.note || row.kind}</span>
                <span className="block text-xs text-faint">
                  {new Date(row.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  row.points > 0 ? "text-success" : "text-heading"
                }`}
              >
                {row.points > 0 ? "+" : "−"}
                {n(Math.abs(row.points))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
