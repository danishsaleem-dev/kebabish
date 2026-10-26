"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Info, Lock, RotateCcw } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { useToast } from "@/components/admin/ui/Toast";
import { closeDayAction, reopenDayAction } from "@/app/admin/(dashboard)/close-day/actions";
import { formatMoney } from "@/lib/admin/units";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/admin/order-types";
import { canClose, type ChecklistItem, type DaySummary, type OpenDay } from "@/lib/business-day";
import type { StoredBusinessDay } from "@/lib/business-days-data";

const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** "Mon 26 Oct, 01:30" in Amsterdam time — identical on the server and in the browser. */
const instantLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000;
}

const TEXT: Record<ChecklistItem["id"], { ok: string; todo: (n: number) => string; help: string }> = {
  waiting: {
    ok: "No orders waiting to be accepted",
    todo: (n) => `${n} paid ${n === 1 ? "order is" : "orders are"} still waiting to be accepted`,
    help: "Accept or decline them first.",
  },
  inProgress: {
    ok: "Nothing is still being cooked or delivered",
    todo: (n) => `${n} ${n === 1 ? "order is" : "orders are"} still being prepared or delivered`,
    help: "Mark them delivered, or cancel them. Orders accepted for a later day don't count.",
  },
  unpaid: {
    ok: "Every order from this day is paid",
    todo: (n) => `${n} ${n === 1 ? "order from this day is" : "orders from this day are"} waiting for payment`,
    help: "Mark cash and payment-link orders paid once the money is in, or cancel them. An online checkout lapses on its own after 15 minutes.",
  },
  rounds: {
    ok: "Every rider has finished their round",
    todo: () => "Not every rider has entered their end reading",
    help: "This doesn't stop the day closing — they can still enter it, or you can correct it under Riders.",
  },
};

const METHOD_ORDER: PaymentMethod[] = ["cash", "mollie", "payment_link", "bank_transfer", "unpaid"];

/**
 * The close-the-day screen: what's still open, the day's figures to audit the cash against,
 * the "Audit done" tick, and the history. The button stays disabled until every blocking item
 * is clear and the audit is ticked — and the server checks all of it again.
 */
export default function CloseDayPanel({
  open,
  items,
  summary,
  laterScheduled,
  now,
  history,
  canReopen,
}: {
  open: OpenDay;
  items: ChecklistItem[];
  summary: DaySummary;
  laterScheduled: number;
  now: string;
  /** Newest first. */
  history: StoredBusinessDay[];
  canReopen: boolean;
}) {
  const [auditDone, setAuditDone] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [reopenArmed, setReopenArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const clear = canClose(items);
  const ready = clear && auditDone;
  const hours = hoursBetween(open.openedAt, now);
  const label = dayLabel(open.businessDate);

  function close() {
    startTransition(async () => {
      const result = await closeDayAction({ openedAt: open.openedAt, auditDone, note });
      toast(result.message, result.ok ? "success" : "error");
      setConfirming(false);
      if (result.ok) {
        setAuditDone(false);
        setNote("");
      }
      router.refresh();
    });
  }

  function reopen(id: string) {
    startTransition(async () => {
      const result = await reopenDayAction(id);
      toast(result.message, result.ok ? "success" : "error");
      setReopenArmed(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ---- which day is open ---- */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-ember-700">Open business day</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-heading">{label}</h2>
        <p className="mt-1 text-sm text-muted">
          {open.firstEver
            ? `Started at midnight — this is the first day you close. Orders from before then keep their calendar day.`
            : `Open since ${instantLabel(open.openedAt)} (${Math.max(0, Math.round(hours))} h), when the previous day was closed.`}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-body-text">
          Closing ends this day right now. Every order placed from this moment belongs to the next
          day, and reports file this day&apos;s orders under {label}, whatever time they came in.
        </p>
        {!open.firstEver && hours > 30 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            This day has been open for {Math.round(hours / 24)} days. Closing it now puts all of those
            orders under {label}. That&apos;s fine if the kitchen was closed in between.
          </p>
        )}
      </Card>

      {/* ---- the checklist ---- */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-heading">Before you close</h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const text = TEXT[item.id];
            const Icon = item.ok ? CircleCheck : item.blocking ? CircleAlert : Info;
            return (
              <li
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.ok
                    ? "border-hairline"
                    : item.blocking
                      ? "border-danger/30 bg-danger-soft/40"
                      : "border-warn/30 bg-warn-soft/50"
                }`}
              >
                <p className="flex items-start gap-2.5 text-sm font-semibold text-heading">
                  <Icon
                    size={18}
                    className={`mt-px shrink-0 ${
                      item.ok ? "text-success" : item.blocking ? "text-danger" : "text-warn"
                    }`}
                  />
                  {item.ok ? text.ok : text.todo(item.orders.length)}
                </p>
                {!item.ok && (
                  <div className="mt-2 pl-7">
                    <p className="text-xs text-muted">{text.help}</p>
                    {item.riders && item.riders.length > 0 && (
                      <p className="mt-1.5 text-sm text-body-text">{item.riders.join(", ")}</p>
                    )}
                    {item.orders.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {item.orders.map((o) => (
                          <li key={o.id}>
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-2.5 py-1.5 text-xs font-semibold text-heading hover:border-ember-500"
                            >
                              {o.reference}
                              <span className="font-normal text-muted">
                                {o.customerName} · {ORDER_STATUS_LABELS[o.status]} ·{" "}
                                {PAYMENT_METHOD_LABELS[o.paymentMethod]} · {formatMoney(o.total)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {laterScheduled > 0 && (
          <p className="mt-3 text-xs text-muted">
            {laterScheduled} {laterScheduled === 1 ? "order is" : "orders are"} accepted for a later
            day. They stay open and belong to that day.
          </p>
        )}
      </Card>

      {/* ---- the audit ---- */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-heading">Cash and totals for {label}</h2>
        <p className="mt-1 text-sm text-muted">
          Paid orders placed since this day opened, after discounts and refunds.
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Figure label="Paid orders" value={String(summary.orders)} />
          <Figure label="Revenue" value={formatMoney(summary.revenue)} />
          <Figure label="Food sales" value={formatMoney(summary.foodSales)} />
          <Figure label="Discounts given" value={formatMoney(summary.discounts)} />
          <Figure label="Delivery fees" value={formatMoney(summary.deliveryFees)} />
          <Figure label="Refunded" value={formatMoney(summary.refunds)} />
        </dl>

        <table className="mt-5 w-full max-w-md text-sm">
          <tbody>
            {METHOD_ORDER.filter((m) => m === "cash" || summary.byMethod[m] > 0).map((m) => (
              <tr key={m} className="border-b border-hairline last:border-0">
                <td className="py-2 text-body-text">
                  {PAYMENT_METHOD_LABELS[m]}
                  {m === "cash" && (
                    <span className="block text-xs text-muted">Should be in the cash box</span>
                  )}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-heading">
                  {formatMoney(summary.byMethod[m])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.cancelled > 0 && (
          <p className="mt-2 text-xs text-muted">
            {summary.cancelled} paid {summary.cancelled === 1 ? "order was" : "orders were"} cancelled
            and {summary.cancelled === 1 ? "isn't" : "aren't"} counted.
          </p>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-4">
          <input
            type="checkbox"
            checked={auditDone}
            onChange={(e) => setAuditDone(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-hairline accent-ember-600"
          />
          <span>
            <span className="block text-sm font-semibold text-heading">Audit done</span>
            <span className="block text-sm text-muted">
              The cash is counted and matches {formatMoney(summary.byMethod.cash)}, and nothing else
              is pending for this day.
            </span>
          </span>
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-heading">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="€5 short in the cash box, explained by…"
            className="w-full rounded-lg border border-hairline bg-panel px-3 py-2 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={close}
                disabled={pending || !ready}
                className="inline-flex items-center gap-2 rounded-lg bg-heading px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Lock size={15} />
                {pending ? "Closing…" : `Yes, close ${label} now`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text hover:bg-canvas"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock size={15} />
              Close the day
            </button>
          )}
          <p className="text-xs text-muted">
            {!clear
              ? "Clear the red items above first."
              : !auditDone
                ? "Tick “Audit done” to close."
                : "The next day starts the moment you close."}
          </p>
        </div>
      </Card>

      {/* ---- history ---- */}
      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-heading">Closed days</h2>
          <p className="mt-1 text-sm text-muted">
            The figures are as they stood when the day was closed.
          </p>
        </div>
        {history.length === 0 ? (
          <p className="border-t border-hairline px-6 py-10 text-center text-sm text-muted">
            No day has been closed yet.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-hairline">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Opened</th>
                  <th className="px-5 py-3">Closed</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">Cash</th>
                  <th className="px-5 py-3">Closed by</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {history.map((day, i) => (
                  <tr key={day.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-3 font-semibold text-heading">{dayLabel(day.businessDate)}</td>
                    <td className="px-5 py-3 text-muted">{instantLabel(day.openedAt)}</td>
                    <td className="px-5 py-3 text-muted">{instantLabel(day.closedAt)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{day.summary.orders ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {day.summary.revenue === undefined ? "—" : formatMoney(day.summary.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {day.summary.byMethod ? formatMoney(day.summary.byMethod.cash ?? 0) : "—"}
                    </td>
                    <td className="px-5 py-3 text-body-text">
                      {day.closedByName ?? "—"}
                      {day.auditNote && <span className="block text-xs text-faint">{day.auditNote}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {i === 0 && canReopen && (
                        reopenArmed ? (
                          <span className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => reopen(day.id)}
                              disabled={pending}
                              className="rounded-lg bg-heading px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Reopen it
                            </button>
                            <button
                              type="button"
                              onClick={() => setReopenArmed(false)}
                              className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-body-text"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReopenArmed(true)}
                            title="Closed by mistake? This joins it back onto the open day."
                            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-body-text hover:bg-canvas"
                          >
                            <RotateCcw size={13} />
                            Reopen
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tabular-nums text-heading">{value}</dd>
    </div>
  );
}
