"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileText, Undo2 } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { Field, Input, SubmitButton, Textarea } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import { refundOrderAction } from "@/app/admin/(dashboard)/orders/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export interface RefundRow {
  id: string;
  creditNoteNumber: string;
  amount: string;
  /** Pre-formatted date. */
  date: string;
  by: string | null;
  viaMollie: boolean;
  reasonCustomer: string | null;
  noteInternal: string | null;
}

/**
 * Refunds on one order: what has been refunded so far (each with its credit
 * note PDF), and — for the owner and staff — a form to refund more, in full or
 * in part. The reason the customer may see and the internal note are separate
 * boxes on purpose; only the first ever leaves the building.
 */
export default function RefundPanel({
  orderId,
  totalLabel,
  remainingCents,
  remainingLabel,
  viaMollie,
  canRefund,
  rows,
}: {
  orderId: string;
  totalLabel: string;
  remainingCents: number;
  remainingLabel: string;
  /** False for a cash/transfer order: the refund is only recorded, a person hands the money back. */
  viaMollie: boolean;
  canRefund: boolean;
  rows: RefundRow[];
}) {
  const [state, formAction] = useActionState(refundOrderAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);
  const [amount, setAmount] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      formRef.current?.reset();
      setAmount("");
    }
  }, [state, toast]);

  if (rows.length === 0 && !(canRefund && remainingCents > 0)) return null;

  return (
    <Card className="print:hidden">
      <CardHeader
        title="Refunds"
        subtitle={
          remainingCents > 0
            ? `${remainingLabel} of ${totalLabel} can still be refunded.`
            : "Everything on this order has been refunded."
        }
      />

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-heading">{r.amount}</p>
                <p className="text-xs text-muted">
                  {r.date}
                  {r.by ? ` · ${r.by}` : ""}
                  {r.viaMollie ? " · via Mollie" : " · paid back by hand"}
                </p>
                {r.reasonCustomer && (
                  <p className="mt-1 text-xs text-body-text">Reason shown to the customer: {r.reasonCustomer}</p>
                )}
                {r.noteInternal && (
                  <p className="mt-1 text-xs text-warn">Internal note: {r.noteInternal}</p>
                )}
              </div>
              <a
                href={`/admin/orders/${orderId}/credit-note?n=${encodeURIComponent(r.creditNoteNumber)}&download=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-heading transition-colors hover:bg-canvas"
              >
                <FileText size={13} />
                {r.creditNoteNumber}
              </a>
            </li>
          ))}
        </ul>
      )}

      {canRefund && remainingCents > 0 && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(event) => {
            const label = amount.trim() ? `€ ${Number(amount.replace(",", ".")).toFixed(2)}` : remainingLabel;
            const how = viaMollie
              ? "It is sent back through Mollie and can't be undone."
              : "This only records it — you hand the money back yourself.";
            if (!window.confirm(`Refund ${label}? ${how}`)) event.preventDefault();
          }}
          className="mt-5 space-y-4 border-t border-hairline pt-5"
        >
          <input type="hidden" name="orderId" value={orderId} />

          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field
              label="Amount (€)"
              hint={`Leave empty to refund all ${remainingLabel}.`}
              error={e.amount}
            >
              <Input
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(ev) => setAmount(ev.target.value)}
                placeholder={(remainingCents / 100).toFixed(2)}
                invalid={Boolean(e.amount)}
              />
            </Field>
            <Field
              label="Reason for the customer (optional)"
              hint="Printed on the credit note and in the email. Leave empty to give none."
            >
              <Input name="reasonCustomer" maxLength={300} placeholder="e.g. one dish was missing" />
            </Field>
          </div>

          <Field label="Internal note (optional)" hint="Only staff ever see this.">
            <Textarea name="noteInternal" rows={2} maxLength={500} />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {viaMollie
                ? "Goes back to the account the customer paid from; it can take a few working days."
                : "This order wasn't paid online, so no money is sent — it records that you returned it."}
            </p>
            <SubmitButton>
              <Undo2 size={15} />
              Refund
            </SubmitButton>
          </div>
        </form>
      )}
    </Card>
  );
}
