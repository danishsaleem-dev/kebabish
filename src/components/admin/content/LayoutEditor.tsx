"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Loader2,
  Lock,
  RotateCcw,
  Save,
} from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { useToast } from "@/components/admin/ui/Toast";
import { saveLayoutAction } from "@/app/admin/(dashboard)/content/actions";
import {
  HOME_SECTIONS,
  layoutWarnings,
  resolveLayout,
  type Band,
  type LayoutEntry,
} from "@/lib/content/model";

const DEFS = new Map(HOME_SECTIONS.map((s) => [s.id, s]));

/** The colour chip beside each row, matching what the section looks like on the page. */
const BAND_CHIP: Record<Band, string> = {
  dark: "bg-charcoal-700",
  ember: "bg-ember-600",
  cream: "bg-cream-300",
  plain: "border border-hairline bg-panel",
};
const BAND_LABEL: Record<Band, string> = {
  dark: "Dark band",
  ember: "Orange band",
  cream: "Pale band",
  plain: "On the page",
};

const same = (a: LayoutEntry[], b: LayoutEntry[]) => JSON.stringify(a) === JSON.stringify(b);

export default function LayoutEditor({
  initial,
  empty,
  custom,
}: {
  initial: LayoutEntry[];
  /** Ids of sections that currently have no content, so they render nothing. */
  empty: string[];
  /** True when a custom layout is saved (not the default order). */
  custom: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(initial);
  const [layout, setLayout] = useState(initial);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const emptySet = useMemo(() => new Set(empty), [empty]);
  const dirty = !same(layout, saved);
  const warnings = useMemo(() => layoutWarnings(layout, emptySet), [layout, emptySet]);
  const isDefault = same(layout, resolveLayout(undefined));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Move row `from` to `to`, never above the pinned banner. */
  function move(from: number, to: number) {
    if (from === to || to < 1 || from < 1 || to >= layout.length) return;
    const next = [...layout];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setLayout(next);
  }

  function toggle(id: string) {
    setLayout((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  }

  function save() {
    startSaving(async () => {
      const result = await saveLayoutAction({ layout });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save.", "error");
        return;
      }
      setSaved(layout);
      toast(result.message ?? "Saved.", "success");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 pb-24 sm:space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-heading">Sections, in order</h2>
            <p className="mt-1 text-sm text-muted">
              Drag a row (or use the arrows) to move a section, and switch it off to hide it from the homepage. The
              top banner always stays first.
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ember-700 hover:underline"
          >
            See the homepage
            <ExternalLink size={13} />
          </a>
        </div>

        <ol className="mt-5 space-y-2">
          {layout.map((entry, i) => {
            const def = DEFS.get(entry.id)!;
            const pinned = Boolean(def.pinned);
            const renders = entry.enabled && !emptySet.has(entry.id);
            return (
              <li
                key={entry.id}
                draggable={!pinned}
                onDragStart={() => !pinned && setDragging(i)}
                onDragOver={(e) => {
                  if (dragging === null || pinned) return;
                  e.preventDefault();
                  setOver(i);
                }}
                onDrop={() => {
                  if (dragging !== null) move(dragging, i);
                  setDragging(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={`flex items-center gap-3 rounded-xl border bg-panel px-3 py-3 transition-colors sm:px-4 ${
                  over === i && dragging !== i ? "border-ember-500 bg-ember-600/5" : "border-hairline"
                } ${dragging === i ? "opacity-50" : ""} ${entry.enabled ? "" : "bg-canvas/60"}`}
              >
                <span
                  className={`flex h-8 w-6 shrink-0 items-center justify-center ${
                    pinned ? "text-faint" : "cursor-grab text-muted active:cursor-grabbing"
                  }`}
                  aria-hidden="true"
                >
                  {pinned ? <Lock size={15} /> : <GripVertical size={18} />}
                </span>

                <span
                  className={`h-9 w-1.5 shrink-0 rounded-full ${BAND_CHIP[def.band]}`}
                  title={BAND_LABEL[def.band]}
                  aria-hidden="true"
                />

                <div className={`min-w-0 flex-1 ${entry.enabled ? "" : "opacity-55"}`}>
                  <p className="truncate text-sm font-semibold text-heading">{def.label}</p>
                  <p className="truncate text-xs text-muted">
                    {def.hint}
                    {entry.enabled && emptySet.has(entry.id) && (
                      <span className="font-medium text-warn"> · Nothing to show yet</span>
                    )}
                  </p>
                </div>

                {!pinned && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      disabled={i <= 1}
                      aria-label={`Move ${def.label} up`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i >= layout.length - 1}
                      aria-label={`Move ${def.label} down`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                )}

                <label
                  className={`flex shrink-0 items-center gap-2 ${pinned ? "pointer-events-none opacity-45" : "cursor-pointer"}`}
                >
                  <span className="sr-only">Show {def.label} on the homepage</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={entry.enabled}
                    disabled={pinned}
                    onChange={() => toggle(entry.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-6 w-11 rounded-full bg-hairline transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-ember-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ember-500/40"
                  />
                  <span className="hidden w-9 text-xs font-semibold text-muted sm:block">
                    {renders ? "Shown" : entry.enabled ? "Empty" : "Hidden"}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          {(Object.keys(BAND_LABEL) as Band[]).map((band) => (
            <span key={band} className="inline-flex items-center gap-1.5">
              <span className={`h-3 w-1.5 rounded-full ${BAND_CHIP[band]}`} />
              {BAND_LABEL[band]}
            </span>
          ))}
        </div>
      </Card>

      {warnings.length > 0 && (
        <Card className="border-warn/30 bg-warn-soft/50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h3 className="font-display text-base font-semibold text-heading">Worth a second look</h3>
              <ul className="mt-1.5 space-y-1 text-sm text-body-text">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">You can still save — this is only a heads-up about how it will look.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="sticky bottom-3 z-20 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel/95 px-4 py-3 shadow-xl backdrop-blur sm:bottom-5">
        <p className="text-sm font-medium text-heading">
          {dirty ? "Unsaved changes" : custom ? "Using your custom layout" : "Using the standard layout"}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLayout(resolveLayout(undefined))}
            disabled={saving || isDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-40"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Standard layout</span>
            <span className="sm:hidden">Reset</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-5 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save &amp; publish
          </button>
        </div>
      </div>
    </div>
  );
}
