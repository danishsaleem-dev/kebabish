"use client";

import { useActionState, useEffect, useRef } from "react";
import { BadgeCheck } from "lucide-react";
import { markOrderPaidAction } from "@/app/admin/(dashboard)/orders/actions";
import { useToast } from "@/components/admin/ui/Toast";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/**
 * For an order entered by hand and not yet paid: the cash arrived, or the
 * transfer did. Asks first, since it also sends the customer their receipt.
 */
export default function MarkPaidControl({
  orderId,
  amount,
}: {
  orderId: string;
  /** Pre-formatted, e.g. "€ 12.00". */
  amount: string;
}) {
  const [state, formAction] = useActionState(markOrderPaidAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Mark ${amount} as received?`)) event.preventDefault();
      }}
      className="print:hidden"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <BadgeCheck size={15} />
        Mark {amount} as paid
      </button>
    </form>
  );
}
