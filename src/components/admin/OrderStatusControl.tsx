"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import { updateOrderStatusAction } from "@/app/admin/(dashboard)/orders/actions";
import {
  ALLOWED_NEXT,
  ORDER_STATUS_LABELS,
  RIDER_STATUSES,
  acceptTarget,
  type OrderStatus,
} from "@/lib/admin/order-types";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/**
 * The one "advance to the next stage" button — same component on the admin
 * order page and the rider dashboard. What's actually allowed is decided
 * server-side (`updateOrderStatus`), this just offers the legal next steps
 * (the first is the primary button; "preparing" also offers skipping the
 * optional "ready" step) and shows whatever the server says if it refuses.
 * A rider only ever sees the steps a rider may take.
 */
export default function OrderStatusControl({
  orderId,
  status,
  riderView = false,
  deliveryDate = null,
}: {
  orderId: string;
  status: OrderStatus;
  riderView?: boolean;
  /** Decides what accepting a new order means: cooking now, or scheduled for a later day. */
  deliveryDate?: string | null;
}) {
  const [state, formAction] = useActionState(updateOrderStatusAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  const options = ALLOWED_NEXT[status].filter(
    (s) =>
      (!riderView || RIDER_STATUSES.includes(s)) &&
      // A new order is accepted as one thing or the other, depending on its day.
      (status !== "new" || s === acceptTarget(deliveryDate))
  );
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {options.map((next, index) => (
        <form action={formAction} key={next}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="nextStatus" value={next} />
          {index === 0 ? (
            <SubmitButton>
              <CheckCircle2 size={15} />
              Mark as {ORDER_STATUS_LABELS[next]}
            </SubmitButton>
          ) : (
            <button
              type="submit"
              className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
            >
              Skip to {ORDER_STATUS_LABELS[next]}
            </button>
          )}
        </form>
      ))}
    </div>
  );
}
