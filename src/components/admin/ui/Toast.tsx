"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Errors stay longer — they usually need reading, not just noticing. */
const LIFETIME: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  error: 7000,
};

const STYLE: Record<ToastKind, { icon: typeof Info; classes: string }> = {
  success: {
    icon: CheckCircle2,
    classes: "border-success/25 bg-success-soft text-success",
  },
  error: {
    icon: CircleAlert,
    classes: "border-danger/25 bg-danger-soft text-danger",
  },
  info: {
    icon: Info,
    classes: "border-hairline bg-panel text-heading",
  },
};

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    // Cap the length so a stray server error can't blow out the layout.
    const clean = message.trim().slice(0, 200);
    if (!clean) return;
    setToasts((prev) => [...prev.slice(-3), { id: nextId++, kind, message: clean }]);
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Bottom-right on desktop, full width at the bottom on mobile. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end print:hidden"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(LIFETIME[toast.kind]);
  // Set in the effect, not here — Date.now() during render is impure.
  const startedRef = useRef(0);

  useEffect(() => {
    if (paused) return;

    startedRef.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingRef.current);

    return () => {
      clearTimeout(timer);
      // Bank the time already elapsed so hovering pauses rather than resets.
      remainingRef.current = Math.max(
        400,
        remainingRef.current - (Date.now() - startedRef.current)
      );
    };
  }, [paused, toast.id, onDismiss]);

  const { icon: Icon, classes } = STYLE[toast.kind];

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`toast-in pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg sm:w-auto sm:min-w-72 sm:max-w-sm ${classes}`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}
