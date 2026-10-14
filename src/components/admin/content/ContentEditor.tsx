"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { Input, Textarea } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import {
  resetContentAction,
  saveContentAction,
} from "@/app/admin/(dashboard)/content/actions";
import type { ContentValue, FaqEntry } from "@/lib/content/model";
import type { EditorField, EditorSection } from "@/lib/content/editor-types";
import { FaqEditor, StringsEditor } from "@/components/admin/content/ListFields";
import HistoryButton, { formatWhen } from "@/components/admin/content/HistoryButton";
import SeoPreview, { SeoCounter } from "@/components/admin/content/SeoPreview";

type Locale = "nl" | "en";

const LOCALES: { id: Locale; label: string; prefix: string }[] = [
  { id: "nl", label: "Dutch", prefix: "" },
  { id: "en", label: "English", prefix: "/en" },
];

const idOf = (key: string, locale: Locale) => `${key}|${locale}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The original text, as one readable line or block, for the "Original" disclosure. */
function showDefault(value: ContentValue): string {
  if (typeof value === "string") return value;
  if (value.length === 0) return "(empty)";
  if (typeof value[0] === "string") return (value as string[]).map((v) => `• ${v}`).join("\n");
  return (value as FaqEntry[]).map((e) => `Q: ${e.q}\nA: ${e.a}`).join("\n\n");
}

export default function ContentEditor({
  sections,
  viewPath,
}: {
  sections: EditorSection[];
  /** Public path (Dutch, no prefix) of the page being edited, for the "View" links. */
  viewPath?: string;
}) {
  const { toast } = useToast();
  const [saving, startSaving] = useTransition();

  // Everything the editor needs to look a field up by its `key|locale` id.
  const index = useMemo(() => {
    const map = new Map<string, { field: EditorField; locale: Locale }>();
    for (const section of sections)
      for (const field of section.fields)
        for (const { id: locale } of LOCALES) map.set(idOf(field.key, locale), { field, locale });
    return map;
  }, [sections]);

  const initial = useMemo(() => {
    const values: Record<string, ContentValue> = {};
    const overridden = new Set<string>();
    const meta: Record<string, { at: string; by: string | null }> = {};
    for (const [id, { field, locale }] of index) {
      const saved = field.saved[locale];
      values[id] = saved ?? field.defaults[locale];
      if (saved !== null) overridden.add(id);
      const m = field.meta[locale];
      if (m) meta[id] = m;
    }
    return { values, overridden, meta };
  }, [index]);

  const [values, setValues] = useState(initial.values);
  const [baseline, setBaseline] = useState(initial.values);
  const [overridden, setOverridden] = useState(initial.overridden);
  const [meta, setMeta] = useState(initial.meta);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirtyIds = useMemo(
    () => [...index.keys()].filter((id) => !same(values[id], baseline[id])),
    [index, values, baseline]
  );

  // Don't let a half-written edit vanish on a stray tab close.
  useEffect(() => {
    if (dirtyIds.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyIds.length]);

  function setValue(id: string, value: ContentValue) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  }

  function save() {
    const changes = dirtyIds.map((id) => {
      const { field, locale } = index.get(id)!;
      return { key: field.key, locale, value: values[id] };
    });
    startSaving(async () => {
      const result = await saveContentAction({ changes });
      if (!result.ok) {
        const errs = result.errors ?? {};
        setErrors(errs);
        toast(result.message ?? "Couldn't save.", "error");
        const first = Object.keys(errs)[0];
        if (first) document.querySelector(`[data-field="${CSS.escape(first)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      setErrors({});
      const now = new Date().toISOString();
      const nextValues = { ...values };
      const nextBaseline = { ...baseline };
      const nextOverridden = new Set(overridden);
      const nextMeta = { ...meta };
      for (const id of dirtyIds) {
        const { field, locale } = index.get(id)!;
        const stored = result.saved?.[id];
        if (stored === null) {
          nextValues[id] = nextBaseline[id] = field.defaults[locale];
          nextOverridden.delete(id);
          delete nextMeta[id];
        } else {
          const cleaned = stored !== undefined ? stored : values[id];
          nextValues[id] = nextBaseline[id] = cleaned;
          if (stored !== undefined) {
            nextOverridden.add(id);
            nextMeta[id] = { at: now, by: "you" };
          }
        }
      }
      setValues(nextValues);
      setBaseline(nextBaseline);
      setOverridden(nextOverridden);
      setMeta(nextMeta);
      toast(result.message ?? "Saved.", "success");
    });
  }

  function discard() {
    setValues(baseline);
    setErrors({});
  }

  async function reset(id: string) {
    const { field, locale } = index.get(id)!;
    if (!window.confirm("Go back to the original text for this field? The edited version stays in History.")) return;
    const result = await resetContentAction({ key: field.key, locale });
    if (!result.ok) {
      toast(result.message ?? "Couldn't reset.", "error");
      return;
    }
    setValues((p) => ({ ...p, [id]: field.defaults[locale] }));
    setBaseline((p) => ({ ...p, [id]: field.defaults[locale] }));
    setOverridden((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    setMeta((p) => {
      const { [id]: _removed, ...rest } = p;
      void _removed;
      return rest;
    });
    toast(result.message ?? "Reset.", "success");
  }

  return (
    <div className="space-y-4 pb-24 sm:space-y-6">
      {/* Jump links: the homepage alone has a dozen blocks. */}
      {sections.length > 3 && (
        <nav
          aria-label="Sections"
          className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#section-${s.id}`}
              className="whitespace-nowrap rounded-full border border-hairline bg-panel px-3 py-1.5 text-xs font-semibold text-body-text transition-colors hover:border-ember-500/40 hover:text-ember-700"
            >
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {viewPath !== undefined && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>See it live:</span>
          {LOCALES.map((l) => (
            <a
              key={l.id}
              href={`${l.prefix}${viewPath}` || "/"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-ember-700 hover:underline"
            >
              {l.label}
              <ExternalLink size={13} />
            </a>
          ))}
        </p>
      )}

      {sections.map((section) => {
        const titleField = section.fields.find((f) => f.seo === "title");
        const descField = section.fields.find((f) => f.seo === "description");
        return (
          <Card key={section.id} id={`section-${section.id}`} className="scroll-mt-24">
            <h2 className="font-display text-lg font-semibold text-heading">{section.title}</h2>
            {section.where && <p className="mt-0.5 text-sm text-muted">{section.where}</p>}

            <div className="mt-5 divide-y divide-hairline">
              {section.fields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  values={values}
                  overridden={overridden}
                  meta={meta}
                  errors={errors}
                  disabled={saving}
                  onChange={setValue}
                  onReset={reset}
                />
              ))}
            </div>

            {titleField && descField && (
              <div className="mt-5 grid gap-3 border-t border-hairline pt-5 md:grid-cols-2">
                {LOCALES.map((l) => (
                  <div key={l.id}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{l.label}</p>
                    <SeoPreview
                      title={String(values[idOf(titleField.key, l.id)] ?? "")}
                      description={String(values[idOf(descField.key, l.id)] ?? "")}
                      suffix={section.id === "home" ? " | Kebabish" : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* Appears the moment something is edited. */}
      {dirtyIds.length > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel/95 px-4 py-3 shadow-xl backdrop-blur sm:bottom-5">
          <p className="text-sm font-medium text-heading">
            {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? "" : "s"}
            <span className="hidden text-muted sm:inline"> — saving puts them on the website</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-50"
            >
              <Undo2 size={15} />
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-5 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save &amp; publish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FieldRow({
  field,
  values,
  overridden,
  meta,
  errors,
  disabled,
  onChange,
  onReset,
}: {
  field: EditorField;
  values: Record<string, ContentValue>;
  overridden: Set<string>;
  meta: Record<string, { at: string; by: string | null }>;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (id: string, value: ContentValue) => void;
  onReset: (id: string) => void;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3">
        <p className="text-sm font-semibold text-heading">{field.label}</p>
        {field.hint && <p className="mt-0.5 text-xs text-muted">{field.hint}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {LOCALES.map((l) => {
          const id = idOf(field.key, l.id);
          const value = values[id];
          const isOverridden = overridden.has(id);
          const error = errors[id];
          const m = meta[id];
          return (
            <div key={l.id} data-field={id} className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`f-${id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  {l.label}
                </label>
                {isOverridden && (
                  <span className="rounded-full bg-ember-600/10 px-2 py-0.5 text-[0.65rem] font-semibold text-ember-700">
                    Edited
                  </span>
                )}
              </div>

              <ValueInput
                id={`f-${id}`}
                field={field}
                value={value}
                invalid={Boolean(error)}
                disabled={disabled}
                onChange={(v) => onChange(id, v)}
              />

              {error ? (
                <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
              ) : (
                <Counter field={field} value={value} />
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
                {isOverridden && (
                  <button
                    type="button"
                    onClick={() => onReset(id)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-40"
                  >
                    <RotateCcw size={13} />
                    Reset to default
                  </button>
                )}
                <HistoryButton
                  fieldKey={field.key}
                  locale={l.id}
                  disabled={disabled}
                  onUse={(old) => onChange(id, old === null ? field.defaults[l.id] : (old as ContentValue))}
                />
              </div>

              {!same(value, field.defaults[l.id]) && (
                <details className="mt-1.5 text-xs text-muted">
                  <summary className="cursor-pointer select-none font-semibold hover:text-heading">
                    Original text
                  </summary>
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-canvas px-3 py-2 text-body-text">
                    {showDefault(field.defaults[l.id])}
                  </p>
                </details>
              )}

              {m && (
                <p className="mt-1 text-[0.7rem] text-faint">
                  Last changed {formatWhen(m.at)}
                  {m.by ? ` by ${m.by}` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValueInput({
  id,
  field,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  field: EditorField;
  value: ContentValue;
  invalid: boolean;
  disabled: boolean;
  onChange: (v: ContentValue) => void;
}) {
  if (field.kind === "strings") {
    return (
      <StringsEditor
        value={value as string[]}
        onChange={onChange}
        max={field.max ?? 60}
        maxItems={field.maxItems ?? 8}
        invalid={invalid}
      />
    );
  }
  if (field.kind === "faq") {
    return (
      <FaqEditor
        value={value as FaqEntry[]}
        onChange={onChange}
        maxItems={field.maxItems ?? 20}
        maxAnswer={field.max ?? 900}
      />
    );
  }
  const text = value as string;
  if (field.kind === "text") {
    return (
      <Input
        id={id}
        value={text}
        invalid={invalid}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Textarea
      id={id}
      value={text}
      invalid={invalid}
      disabled={disabled}
      rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Counter({ field, value }: { field: EditorField; value: ContentValue }) {
  if (field.seo) {
    return (
      <p className="mt-1.5">
        <SeoCounter kind={field.seo} length={String(value).trim().length} />
      </p>
    );
  }
  if (field.kind === "text" || field.kind === "longtext") {
    const length = String(value).length;
    const max = field.max ?? 200;
    return (
      <p className={`mt-1.5 text-right text-xs ${length > max ? "font-medium text-danger" : "text-faint"}`}>
        {length} / {max}
      </p>
    );
  }
  return null;
}
