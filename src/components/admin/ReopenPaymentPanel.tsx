"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, RotateCcw } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { useToast } from "@/components/admin/ui/Toast";
import { reopenPaymentAction, reopenSlotsAction } from "@/app/admin/(dashboard)/orders/payment-actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { AdminSlotRow } from "@/lib/delivery-slots-data";
import { REOPEN_HOURS } from "@/lib/payment-window";

const EMPTY: FormState = { ok: false };
const HOUR_LABELS: Record<number, string> = { 1: "1 hour", 3: "3 hours", 24: "24 hours", 72: "3 days" };
const field =
  "w-full rounded-lg border border-hairline bg-panel px-3 py-2.5 text-sm text-heading";

interface Window {
  date: string;
  start: string;
  end: string;
}

/**
 * An unpaid online order: send the customer the link, or reopen payment for longer and at
 * another delivery time. See lib/payment-window.ts.
 */
export default function ReopenPaymentPanel({
  orderId,
  reference,
  today,
  current,
  inProgress,
  payableLabel,
  link,
  whatsappHref,
}: {
  orderId: string;
  reference: string;
  /** Amsterdam's date, "YYYY-MM-DD". */
  today: string;
  /** The order's delivery window, when it hasn't ended yet. */
  current: Window | null;
  /** A payment is running right now, so there is nothing to reopen yet. */
  inProgress: boolean;
  /** "until Fri 27 Nov, 20:15" while the customer can still pay, else null. */
  payableLabel: string | null;
  link: string;
  whatsappHref: string | null;
}) {
  const [state, formAction, pending] = useActionState(reopenPaymentAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);
  const [date, setDate] = useState(current?.date ?? today);
  // Stored with the date it describes, so a day change needs no clearing step.
  const [answer, setAnswer] = useState<{ date: string; rows: AdminSlotRow[] } | null>(null);
  const [picked, setPicked] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  useEffect(() => {
    if (inProgress) return;
    let cancelled = false;
    reopenSlotsAction(date)
      .catch(() => [] as AdminSlotRow[])
      .then((rows) => {
        if (!cancelled) setAnswer({ date, rows });
      });
    return () => {
      cancelled = true;
    };
  }, [date, inProgress, state]);

  const loading = answer?.date !== date;
  const options = (loading ? [] : answer!.rows).map((r) => {
    const full = !r.enabled || r.bookedCount >= r.maxOrders;
    return {
      value: `${date}|${r.start}|${r.end}`,
      full,
      label: `${r.start}–${r.end} (${r.enabled ? `${r.bookedCount}/${r.maxOrders} booked` : "switched off"})`,
    };
  });
  // An exact, off-grid time on the order can still be kept.
  const currentValue = current ? `${current.date}|${current.start}|${current.end}` : "";
  if (!loading && current && current.date === date && !options.some((o) => o.value === currentValue)) {
    options.unshift({ value: currentValue, full: false, label: `${current.start}–${current.end} (current time)` });
  }
  const usable = options.filter((o) => !o.full);
  const selected =
    usable.find((o) => o.value === picked)?.value ??
    usable.find((o) => o.value === currentValue)?.value ??
    usable[0]?.value ??
    "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy — select the link and copy it by hand.", "error");
    }
  }

  const secondary =
    "inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas";

  return (
    <Card className="print:hidden">
      <CardHeader
        title="Payment"
        subtitle={
          inProgress
            ? "A payment is in progress. If it isn't completed it expires after about 15 minutes, and you can reopen it here."
            : payableLabel
              ? `Not paid. The customer can still pay ${payableLabel}.`
              : "Not paid, and the time to pay has run out. Reopen it so the customer can pay."
        }
      />

      {payableLabel && !inProgress && (
        <div className="mt-4 space-y-2">
          <input readOnly value={link} aria-label="Payment link" onFocus={(e) => e.target.select()} className={field} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={secondary}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy link"}
            </button>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={secondary}>
                <MessageCircle size={15} className="text-success" />
                Send on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {!inProgress && (
        <form action={formAction} className="mt-5 grid gap-3 border-t border-hairline pt-5 sm:grid-cols-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="reference" value={reference} />
          <label className="text-xs font-semibold text-muted">
            Link works for
            <select name="hours" defaultValue={3} className={`mt-1.5 ${field}`}>
              {REOPEN_HOURS.map((h) => (
                <option key={h} value={h}>
                  {HOUR_LABELS[h]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Delivery day
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            Delivery time
            <select
              name="slot"
              value={selected}
              onChange={(e) => setPicked(e.target.value)}
              disabled={usable.length === 0}
              className={`mt-1.5 ${field}`}
            >
              {usable.length === 0 && (
                <option value="">{loading ? "Loading…" : "No times left that day"}</option>
              )}
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.full}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
            <p className="max-w-md text-xs text-muted">
              The customer is emailed the link. The time is only booked once they pay, even if it is already running.
            </p>
            <button
              type="submit"
              disabled={pending || !selected}
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ember-500 disabled:opacity-50"
            >
              <RotateCcw size={15} />
              {pending ? "Reopening…" : "Reopen payment"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
