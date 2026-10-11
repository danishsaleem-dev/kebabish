"use client";

import { useActionState, useEffect, useRef } from "react";
import { Undo2 } from "lucide-react";
import { refundOrderAction } from "@/app/admin/(dashboard)/orders/actions";
import { useToast } from "@/components/admin/ui/Toast";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/**
 * Full refund of a paid order, through Mollie. Asks first — it moves real
 * money and can't be undone from here.
 */
export default function RefundControl({
  orderId,
  amount,
}: {
  orderId: string;
  /** Pre-formatted, e.g. "€ 12.00". */
  amount: string;
}) {
  const [state, formAction] = useActionState(refundOrderAction, EMPTY);
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
        if (!window.confirm(`Refund ${amount} to the customer? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
      className="print:hidden"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
      >
        <Undo2 size={15} />
        Refund {amount}
      </button>
    </form>
  );
}
