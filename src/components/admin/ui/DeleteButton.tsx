"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import { useToast } from "@/components/admin/ui/Toast";

const EMPTY: FormState = { ok: false };

/**
 * Two-step delete: the first click arms it, the second commits. Cheaper than
 * a modal and it still stops an accidental single click destroying a record.
 * Outcomes (including refusals like "category still has items") surface
 * as a toast.
 */
export default function DeleteButton({
  action,
  hiddenField,
  label = "Delete",
  compact = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hiddenField: { name: string; value: string };
  label?: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const [armed, setArmed] = useState(false);
  const { toast } = useToast();

  // Surface the action's outcome as a toast. The ref stops React's
  // re-renders replaying the same message.
  const lastRef = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.message || lastRef.current === state) return;
    lastRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name={hiddenField.name} value={hiddenField.value} />

      {armed ? (
        <span className="flex items-center gap-1.5">
          <Submit compact={compact} />
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="rounded-lg border border-hairline px-2.5 py-2 text-xs font-semibold text-body-text hover:bg-canvas"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          aria-label={label}
          className={
            compact
              ? "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              : "inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          }
        >
          <Trash2 size={compact ? 15 : 16} />
          {!compact && label}
        </button>
      )}


    </form>
  );
}

/** Separate component so useFormStatus can read the parent form's state. */
function Submit({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-danger px-2.5 py-2 font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      Confirm
    </button>
  );
}
