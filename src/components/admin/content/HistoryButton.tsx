"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { historyAction, type HistoryEntry } from "@/app/admin/(dashboard)/content/actions";

/** A one-line description of any stored value, for the history list. */
export function describeValue(value: unknown): string {
  if (typeof value === "string") return value.length > 110 ? `${value.slice(0, 110)}…` : value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "An empty list";
    if (typeof value[0] === "string") return (value as string[]).join(" · ").slice(0, 110);
    if (value[0] && typeof value[0] === "object" && "q" in value[0]) {
      return `${value.length} question${value.length === 1 ? "" : "s"}: “${String((value[0] as { q: string }).q).slice(0, 50)}…”`;
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  return "A change";
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "History" under a field: the last values saved for it, newest first. "Use
 * this" puts the old value into the field as an unsaved edit — it never saves by
 * itself, so looking at history can't change the live site.
 */
export default function HistoryButton({
  fieldKey,
  locale,
  onUse,
  disabled,
}: {
  fieldKey: string;
  locale: string;
  /** Called with the old value, or null for an old "reset to default". */
  onUse: (value: unknown | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setError(null);
      start(async () => {
        const result = await historyAction({ key: fieldKey, locale });
        if (result.ok) setEntries(result.entries);
        else setError(result.message);
      });
    }
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-40"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
        History
      </button>

      {open && (
        <div className="mt-2 w-[min(100%,28rem)] rounded-xl border border-hairline bg-panel p-2 shadow-lg">
          {error && <p className="px-2 py-1.5 text-xs text-danger">{error}</p>}
          {!error && entries && entries.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted">No changes have been saved to this field yet.</p>
          )}
          <ul className="max-h-64 divide-y divide-hairline overflow-y-auto">
            {entries?.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-2 py-2">
                <div className="min-w-0">
                  <p className="break-words text-xs text-heading">
                    {entry.value === null ? (
                      <em className="text-muted">Reset to the original text</em>
                    ) : (
                      describeValue(entry.value)
                    )}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-faint">
                    {formatWhen(entry.changedAt)}
                    {entry.changedBy ? ` · ${entry.changedBy}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUse(entry.value);
                    setOpen(false);
                  }}
                  className="shrink-0 rounded-md border border-hairline px-2 py-1 text-xs font-semibold text-ember-700 hover:bg-canvas"
                >
                  Use this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
