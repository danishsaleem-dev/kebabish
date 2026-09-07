"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import { updateOrderStatusAction } from "@/app/admin/(dashboard)/orders/actions";
import { NEXT_STATUS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-types";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/**
 * The one "advance to the next stage" button — same component on the admin
 * order page and the rider dashboard. What's actually allowed is decided
 * server-side (`updateOrderStatus`), this just offers the one legal next
 * step and shows whatever the server says if it refuses.
 */
export default function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, formAction] = useActionState(updateOrderStatusAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  const next = NEXT_STATUS[status];
  if (!next) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="nextStatus" value={next} />
      <SubmitButton>
        <CheckCircle2 size={15} />
        Mark as {ORDER_STATUS_LABELS[next]}
      </SubmitButton>
    </form>
  );
}
