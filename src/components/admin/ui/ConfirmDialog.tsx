"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

/**
 * A modal for actions that can't be undone. `DeleteButton`'s two-click arm is fine
 * for a dish; this is for things where the owner needs to *read* what is about to
 * happen first (orders, customers) and, when it matters, type a word to prove it.
 *
 * Mount it only while open (`{open && <ConfirmDialog …/>}`): its typed text is then
 * fresh every time, with no effect resetting state after the fact.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy = false,
  /** When set, the confirm button stays disabled until this word is typed. */
  requireWord,
  /** Disables confirm for other reasons (e.g. still loading the preview). */
  blocked = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  requireWord?: string;
  blocked?: boolean;
  /** Receives whatever was typed (empty when no word is required). */
  onConfirm: (typed: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (requireWord ? inputRef.current : cancelRef.current)?.focus();
  }, [requireWord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const wordOk = !requireWord || typed.trim() === requireWord;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal-950/55 p-3 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-2xl bg-panel p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert size={19} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-display text-lg font-semibold text-heading">
              {title}
            </h2>
            <div className="mt-2 space-y-3 text-sm text-body-text">{children}</div>
          </div>
        </div>

        {requireWord && (
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium text-heading">
              Type <strong className="font-semibold">{requireWord}</strong> to confirm
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full rounded-lg border border-hairline bg-panel px-3 py-2.5 text-sm text-heading focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
            />
          </label>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typed.trim())}
            disabled={busy || blocked || !wordOk}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-45"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A tinted callout inside the dialog body. */
export function Callout({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "danger" | "info";
  children: ReactNode;
}) {
  const style =
    tone === "danger"
      ? "bg-danger-soft text-danger"
      : tone === "info"
        ? "bg-canvas text-body-text"
        : "bg-warn-soft text-warn";
  return <div className={`rounded-xl px-3.5 py-3 text-sm ${style}`}>{children}</div>;
}
