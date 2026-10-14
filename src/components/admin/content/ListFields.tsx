"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input, Textarea } from "@/components/admin/ui/Form";
import type { FaqEntry } from "@/lib/content/model";

/** Move item `from` to position `to` in a copy of the list. */
function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-35 disabled:hover:bg-transparent";

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={iconButton}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp size={15} />
      </button>
      <button
        type="button"
        className={iconButton}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown size={15} />
      </button>
      <button
        type="button"
        className={`${iconButton} hover:!bg-danger-soft hover:!text-danger`}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/** A list of short strings — the scrolling strip's phrases, the ticked points. */
export function StringsEditor({
  value,
  onChange,
  max,
  maxItems,
  invalid,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxItems: number;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            maxLength={max + 40}
            invalid={invalid && !item.trim()}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            aria-label={`Item ${i + 1}`}
          />
          <RowControls
            index={i}
            count={value.length}
            label={`item ${i + 1}`}
            onMove={(to) => onChange(move(value, i, to))}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={value.length >= maxItems}
        onClick={() => onChange([...value, ""])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 py-2 text-sm font-semibold text-ember-700 transition-colors hover:bg-canvas disabled:opacity-40"
      >
        <Plus size={15} />
        Add
      </button>
    </div>
  );
}

/** Question-and-answer pairs — the homepage FAQ. */
export function FaqEditor({
  value,
  onChange,
  maxItems,
  maxAnswer,
}: {
  value: FaqEntry[];
  onChange: (next: FaqEntry[]) => void;
  maxItems: number;
  maxAnswer: number;
}) {
  return (
    <div className="space-y-3">
      {value.map((entry, i) => (
        <div key={i} className="rounded-xl border border-hairline bg-canvas/50 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-faint">
              Question {i + 1}
            </span>
            <RowControls
              index={i}
              count={value.length}
              label={`question ${i + 1}`}
              onMove={(to) => onChange(move(value, i, to))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <Input
            className="mt-2"
            value={entry.q}
            placeholder="The question"
            maxLength={240}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))}
            aria-label={`Question ${i + 1}`}
          />
          <Textarea
            className="mt-2"
            rows={3}
            value={entry.a}
            placeholder="The answer"
            maxLength={maxAnswer + 100}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, a: e.target.value } : v)))}
            aria-label={`Answer ${i + 1}`}
          />
          <p className="mt-1 text-right text-xs text-faint">
            {entry.a.length} / {maxAnswer}
          </p>
        </div>
      ))}
      <button
        type="button"
        disabled={value.length >= maxItems}
        onClick={() => onChange([...value, { q: "", a: "" }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 py-2 text-sm font-semibold text-ember-700 transition-colors hover:bg-canvas disabled:opacity-40"
      >
        <Plus size={15} />
        Add a question
      </button>
    </div>
  );
}
