"use client";

import { useActionState, useEffect, useRef } from "react";
import { assignRiderAction } from "@/app/admin/(dashboard)/orders/actions";
import { Select } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { AdminUser } from "@/lib/admin/auth-users";

const EMPTY: FormState = { ok: false };

export default function AssignRiderControl({
  orderId,
  riders,
  assignedRiderId,
}: {
  orderId: string;
  riders: AdminUser[];
  assignedRiderId: string | null;
}) {
  const [state, formAction] = useActionState(assignRiderAction, EMPTY);
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <Select
        name="riderId"
        defaultValue={assignedRiderId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Unassigned</option>
        {riders.map((rider) => (
          <option key={rider.id} value={rider.id}>
            {rider.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
