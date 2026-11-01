import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { listReferrals } from "@/lib/referrals";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { isOwner } from "@/lib/admin/guard";
import { formatEuro, fromCents } from "@/lib/money";
import { customerNames, getRewardsConfig, listLedger, rewardsOverview } from "@/lib/rewards";
import { valueOfPoints } from "@/lib/rewards-math";
import { adjustPointsAction, saveRewardsRulesAction } from "./actions";

export const metadata = { title: "Rewards" };
export const dynamic = "force-dynamic";

const n = (value: number) => value.toLocaleString("en-GB");

const KIND_LABEL: Record<string, string> = {
  earn: "Earned",
  welcome: "Welcome bonus",
  redeem: "Spent",
  restore: "Given back",
  clawback: "Taken back",
  adjust: "Adjusted by staff",
  referral: "Friend's order",
};

const REFERRAL_STATUS: Record<string, string> = {
  pending: "Waiting for delivery",
  rewarded: "Rewarded",
  capped: "Monthly limit reached",
  cancelled: "Cancelled",
};

const inputClass =
  "h-10 w-full rounded-lg border border-hairline bg-panel px-3 text-sm text-body-text focus:border-ember-600 focus:outline-none";
const buttonClass =
  "rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500";

export default async function RewardsPage() {
  const [config, overview, owner, ledger, referrals] = await Promise.all([
    getRewardsConfig(),
    rewardsOverview(),
    isOwner(),
    listLedger({ limit: 40 }),
    listReferrals(),
  ]);
  const names = await customerNames(ledger.map((r) => r.customerId));
  const earned = overview.byKind.earn + overview.byKind.welcome + overview.byKind.referral;

  return (
    <AdminShell title="Rewards">
      <div className="space-y-4 sm:space-y-6">
        {!overview.ready && (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
              <DatabaseZap size={22} />
            </span>
            <h2 className="font-display text-lg font-semibold text-heading">Rewards aren&apos;t set up yet</h2>
            <p className="max-w-md text-sm text-muted">
              Run <code className="rounded bg-hairline px-1">supabase/migrations/0029_rewards.sql</code> once
              in the Supabase SQL editor. Until then no points are earned or shown, and the website
              works exactly as before.
            </p>
          </Card>
        )}

        {overview.ready && (
          <Card>
            <CardHeader
              title="Kebabish Punten"
              subtitle="Points customers hold right now, and where they came from."
            />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Points out there"
                value={n(overview.outstanding)}
                hint={`worth about ${formatEuro(fromCents(valueOfPoints(overview.outstanding, config)))}`}
              />
              <Stat label="Earned" value={n(earned)} hint="orders, welcome bonuses, referrals" />
              <Stat label="Spent" value={n(-overview.byKind.redeem)} hint="used at checkout" />
              <Stat
                label="Taken back / given back"
                value={`${n(-overview.byKind.clawback)} / ${n(overview.byKind.restore)}`}
                hint="refunds and cancellations"
              />
            </dl>
            <p className="mt-3 text-xs text-muted">
              &ldquo;Worth about&rdquo; is what those points cost the shop if every one were spent.
              Points are earned when an order is delivered and paid, and spent when the order is paid.
            </p>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Rules"
            subtitle={
              owner
                ? "What a customer earns and what points are worth. Changes apply to new orders only."
                : "Only the owner can change these."
            }
          />
          <form action={saveRewardsRulesAction} className="mt-4 space-y-4">
            <fieldset disabled={!owner} className="space-y-4 disabled:opacity-70">
              <label className="flex items-center gap-2.5 text-sm font-semibold text-heading">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={config.enabled}
                  className="h-4 w-4 rounded accent-ember-600"
                />
                Rewards are switched on
              </label>
              <p className="-mt-2 text-xs text-muted">
                Off: nothing is earned, shown or spent. Switch it on only after the migration has been run.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="pointsPerEuro" label="Points earned per €1 of food" hint="After any discount. Never on delivery.">
                  <input id="pointsPerEuro" name="pointsPerEuro" inputMode="numeric" defaultValue={config.pointsPerEuro} className={inputClass} />
                </Field>
                <Field id="welcomePoints" label="Welcome bonus (points)" hint="Paid with a customer's first rewarded order. 0 = none.">
                  <input id="welcomePoints" name="welcomePoints" inputMode="numeric" defaultValue={config.welcomePoints} className={inputClass} />
                </Field>
                <Field id="redeemStepPoints" label="Points for one reward" hint="Points are spent in whole steps of this size.">
                  <input id="redeemStepPoints" name="redeemStepPoints" inputMode="numeric" defaultValue={config.redeemStepPoints} className={inputClass} />
                </Field>
                <Field id="redeemStepEuros" label="Money off for one reward (€)" hint="What one step takes off the basket.">
                  <input id="redeemStepEuros" name="redeemStepEuros" inputMode="decimal" defaultValue={(config.redeemStepCents / 100).toFixed(2)} className={inputClass} />
                </Field>
                <Field id="maxSharePercent" label="Highest share of an order points may cover (%)" hint="Stops points from making a basket free.">
                  <input id="maxSharePercent" name="maxSharePercent" inputMode="numeric" defaultValue={config.maxSharePercent} className={inputClass} />
                </Field>
              </div>

              <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-body-text">
                With these numbers a customer gets back{" "}
                <strong>
                  {((config.redeemStepCents / 100 / (config.redeemStepPoints / config.pointsPerEuro)) * 100).toFixed(1)}%
                </strong>{" "}
                of what they spend: {n(config.redeemStepPoints)} points take{" "}
                {formatEuro(fromCents(config.redeemStepCents))} off, and it takes{" "}
                {formatEuro(config.redeemStepPoints / config.pointsPerEuro)} of food to earn them.
              </p>

              <div className="space-y-3 border-t border-hairline pt-4">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-heading">
                  <input
                    type="checkbox"
                    name="referralEnabled"
                    defaultChecked={config.referralEnabled}
                    className="h-4 w-4 rounded accent-ember-600"
                  />
                  Referrals are switched on
                </label>
                <p className="text-xs text-muted">
                  Needs migration 0030 and rewards switched on. A friend gets money off their first order;
                  the customer who invited them gets points once it is delivered.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="referralFriendEuros" label="Friend's discount (€)">
                    <input id="referralFriendEuros" name="referralFriendEuros" inputMode="decimal" defaultValue={(config.referralFriendCents / 100).toFixed(2)} className={inputClass} />
                  </Field>
                  <Field id="referralRewardPoints" label="Points for the customer">
                    <input id="referralRewardPoints" name="referralRewardPoints" inputMode="numeric" defaultValue={config.referralRewardPoints} className={inputClass} />
                  </Field>
                  <Field id="referralMonthlyCap" label="Friends rewarded per month">
                    <input id="referralMonthlyCap" name="referralMonthlyCap" inputMode="numeric" defaultValue={config.referralMonthlyCap} className={inputClass} />
                  </Field>
                </div>
              </div>
            </fieldset>
            {owner && (
              <button type="submit" className={buttonClass}>
                Save rules
              </button>
            )}
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Add or remove points"
            subtitle="For a late order, an apology or a mistake. Recorded with your name and the reason."
          />
          <form action={adjustPointsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="adjust-email" label="Customer's email">
              <input id="adjust-email" name="email" type="email" required className={inputClass} />
            </Field>
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <Field id="adjust-direction" label="Action">
                <select id="adjust-direction" name="direction" className={inputClass} defaultValue="add">
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </Field>
              <Field id="adjust-points" label="Points">
                <input id="adjust-points" name="points" inputMode="numeric" required className={inputClass} />
              </Field>
            </div>
            <Field id="adjust-note" label="Reason" className="sm:col-span-2" hint="The customer sees this on their dashboard.">
              <input id="adjust-note" name="note" required maxLength={200} placeholder="Sorry the order was late" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                Save change
              </button>
            </div>
          </form>
        </Card>

        {referrals.length > 0 && (
          <Card padded={false}>
            <div className="p-5 sm:p-6">
              <CardHeader
                title="Referrals"
                subtitle="The latest 30. If one looks wrong, cancel the order or remove the points above."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-hairline bg-canvas text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5 font-semibold">When</th>
                    <th className="px-3 py-2.5 font-semibold">Invited by</th>
                    <th className="px-3 py-2.5 font-semibold">Friend</th>
                    <th className="px-3 py-2.5 font-semibold">Order</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {referrals.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                        {new Date(r.createdAt).toLocaleDateString("en-GB", {
                          timeZone: "Europe/Amsterdam",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-heading">{r.referrerName || "—"}</span>
                        <span className="block text-xs text-muted">{r.referrerEmail}</span>
                      </td>
                      <td className="px-3 py-2.5 text-body-text">{r.friendName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/orders/${r.orderId}`} className="font-semibold text-ember-700 hover:underline">
                          {r.orderReference ?? "—"}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-right text-body-text">
                        {REFERRAL_STATUS[r.status] ?? r.status}
                        {r.points > 0 ? ` · +${n(r.points)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader title="Latest activity" subtitle="The 40 most recent changes, across all customers." />
          </div>
          {ledger.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">Nothing yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-hairline bg-canvas text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5 font-semibold">When</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">What</th>
                    <th className="px-3 py-2.5 font-semibold">Note</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {ledger.map((row) => {
                    const who = names.get(row.customerId);
                    return (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                          {new Date(row.createdAt).toLocaleString("en-GB", {
                            timeZone: "Europe/Amsterdam",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block text-heading">{who?.name || "—"}</span>
                          <span className="block text-xs text-muted">{who?.email}</span>
                        </td>
                        <td className="px-3 py-2.5">{KIND_LABEL[row.kind] ?? row.kind}</td>
                        <td className="px-3 py-2.5 text-muted">{row.note}</td>
                        <td
                          className={`px-5 py-2.5 text-right font-semibold tabular-nums ${
                            row.points > 0 ? "text-success" : "text-heading"
                          }`}
                        >
                          {row.points > 0 ? "+" : "−"}
                          {n(Math.abs(row.points))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-heading">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-heading">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
