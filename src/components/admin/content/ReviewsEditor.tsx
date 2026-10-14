"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Info, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { Input, Textarea } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import { saveReviewsAction } from "@/app/admin/(dashboard)/content/actions";
import HistoryButton from "@/components/admin/content/HistoryButton";
import { REVIEWS_KEY } from "@/lib/content/registry";
import type { Review } from "@/lib/reviews-data";

/** A row being edited; rating is 0 until a star is chosen. */
interface Draft {
  name: string;
  text: string;
  rating: number;
  source: string;
}

const toDraft = (r: Review): Draft => ({ name: r.name, text: r.text, rating: r.rating, source: r.source ?? "" });
const blank = (): Draft => ({ name: "", text: "", rating: 5, source: "" });
const same = (a: Draft[], b: Draft[]) => JSON.stringify(a) === JSON.stringify(b);

const SOURCES = ["Google", "Facebook", "Instagram", "WhatsApp", "Trustpilot"];

export default function ReviewsEditor({ initial }: { initial: Review[] }) {
  const { toast } = useToast();
  const [saving, startSaving] = useTransition();
  const start = initial.map(toDraft);
  const [saved, setSaved] = useState(start);
  const [rows, setRows] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = !same(rows, saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patch(i: number, change: Partial<Draft>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...change } : r)));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(change)) delete next[`${i}.${k}`];
      return next;
    });
  }

  function move(i: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    setRows(next);
    setErrors({});
  }

  function save() {
    startSaving(async () => {
      const result = await saveReviewsAction({
        reviews: rows.map((r) => ({
          name: r.name,
          text: r.text,
          rating: r.rating as Review["rating"],
          source: r.source || undefined,
        })),
      });
      if (!result.ok) {
        setErrors(result.errors ?? {});
        toast(result.message ?? "Couldn't save.", "error");
        return;
      }
      setErrors({});
      // The server drops untouched blank rows; mirror that so the bar clears.
      const kept = rows.filter((r) => r.name.trim() || r.text.trim());
      setRows(kept);
      setSaved(kept);
      toast(result.message ?? "Saved.", "success");
    });
  }

  const real = rows.filter((r) => r.name.trim() && r.text.trim());
  const average = real.length ? real.reduce((s, r) => s + r.rating, 0) / real.length : null;

  return (
    <div className="space-y-4 pb-24 sm:space-y-6">
      <Card className="bg-canvas/60">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div className="max-w-3xl text-sm text-body-text">
            <p>
              Only add reviews customers really gave you, and quote them as they wrote them. They appear in the
              customer quotes block on the homepage and on the Reviews page, and Google is given the average rating
              {average !== null && (
                <>
                  {" "}
                  (currently <strong>{average.toFixed(1)}</strong> from {real.length})
                </>
              )}
              . A review stays in the language it was written in on both versions of the site.
            </p>
            <p className="mt-2 text-muted">
              Until you add at least one, the quotes block and the Reviews page link stay hidden.
            </p>
          </div>
        </div>
      </Card>

      {rows.length === 0 && (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">No reviews yet.</p>
        </Card>
      )}

      {rows.map((row, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Review {i + 1}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move review ${i + 1} up`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas disabled:opacity-35"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === rows.length - 1}
                aria-label={`Move review ${i + 1} down`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas disabled:opacity-35"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRows(rows.filter((_, j) => j !== i));
                  setErrors({});
                }}
                aria-label={`Remove review ${i + 1}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-heading">Customer&apos;s name</span>
              <Input
                value={row.name}
                maxLength={80}
                invalid={Boolean(errors[`${i}.name`])}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="e.g. Sanne de Vries"
              />
              {errors[`${i}.name`] && <span className="mt-1 block text-xs font-medium text-danger">{errors[`${i}.name`]}</span>}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-heading">Where they said it</span>
              <Input
                value={row.source}
                maxLength={50}
                list="review-sources"
                invalid={Boolean(errors[`${i}.source`])}
                onChange={(e) => patch(i, { source: e.target.value })}
                placeholder="Optional — Google, WhatsApp…"
              />
              {errors[`${i}.source`] && <span className="mt-1 block text-xs font-medium text-danger">{errors[`${i}.source`]}</span>}
            </label>
          </div>

          <div className="mt-3">
            <span className="mb-1.5 block text-sm font-medium text-heading">Stars</span>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={row.rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => patch(i, { rating: n })}
                  className="rounded-md p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={24}
                    className={n <= row.rating ? "fill-warn text-warn" : "text-hairline"}
                  />
                </button>
              ))}
            </div>
            {errors[`${i}.rating`] && <span className="mt-1 block text-xs font-medium text-danger">{errors[`${i}.rating`]}</span>}
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-heading">What they said</span>
            <Textarea
              rows={4}
              value={row.text}
              maxLength={600}
              invalid={Boolean(errors[`${i}.text`])}
              onChange={(e) => patch(i, { text: e.target.value })}
              placeholder="Paste or type the quote, exactly as written."
            />
            <span className="mt-1 flex items-start justify-between gap-3 text-xs">
              <span className="font-medium text-danger">{errors[`${i}.text`]}</span>
              <span className="shrink-0 text-faint">{row.text.length} / 600</span>
            </span>
          </label>
        </Card>
      ))}

      <datalist id="review-sources">
        {SOURCES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows([...rows, blank()])}
          disabled={rows.length >= 60}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-hairline bg-panel px-4 py-2.5 text-sm font-semibold text-ember-700 transition-colors hover:bg-canvas disabled:opacity-40"
        >
          <Plus size={16} />
          Add a review
        </button>
        <HistoryButton
          fieldKey={REVIEWS_KEY}
          locale="*"
          disabled={saving}
          onUse={(old) => {
            const list = Array.isArray(old) ? (old as Review[]).map(toDraft) : [];
            setRows(list);
          }}
        />
      </div>

      {dirty && (
        <div className="sticky bottom-3 z-20 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel/95 px-4 py-3 shadow-xl backdrop-blur sm:bottom-5">
          <p className="text-sm font-medium text-heading">Unsaved changes</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRows(saved);
                setErrors({});
              }}
              disabled={saving}
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-50"
            >
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
