"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Mail, MessageSquareQuote, Quote } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { toggleFeedbackHandledAction } from "@/app/admin/(dashboard)/feedback/actions";
import { UNHAPPY_AT_OR_BELOW } from "@/lib/feedback/questions";
import type { StoredFeedback } from "@/lib/feedback/data";
import { questionLabel, scaleLabel, type FeedbackLabels } from "@/lib/feedback/label-types";

type Filter = "all" | "followup" | "comments" | "quote" | "handled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "followup", label: "Needs follow-up" },
  { id: "comments", label: "With a comment" },
  { id: "quote", label: "OK to quote" },
  { id: "handled", label: "Handled" },
];

const SOURCE_LABELS: Record<string, string> = {
  email: "Delivered email",
  dashboard: "Account",
  confirmation: "Order page",
  footer: "Footer link",
  contact: "Contact page",
  site: "Site banner",
  qr: "Scanned the site QR",
  packaging: "Packaging / QR",
  direct: "Direct link",
};

function tone(recommend: number | null) {
  if (recommend == null) return "bg-canvas text-muted";
  if (recommend <= UNHAPPY_AT_OR_BELOW) return "bg-danger-soft text-danger";
  if (recommend === 3) return "bg-warn-soft text-warn";
  return "bg-success-soft text-success";
}

/**
 * Every response, newest first, filterable. "Needs follow-up" is the one that
 * matters day to day: an unhappy customer nobody has dealt with yet, which is
 * what the low-score email also points at. Marking one handled takes it out of
 * that list and out of the count on the summary above.
 */
export default function FeedbackResponses({
  items,
  labels,
}: {
  items: StoredFeedback[];
  labels: FeedbackLabels;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  // Optimistic overrides, so the row updates the moment it's clicked.
  const [handledOverride, setHandledOverride] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const isHandled = (item: StoredFeedback) => handledOverride[item.id] ?? Boolean(item.handledAt);
  const needsFollowUp = (item: StoredFeedback) =>
    (item.recommend ?? 99) <= UNHAPPY_AT_OR_BELOW && !isHandled(item);

  const visible = items.filter((item) => {
    switch (filter) {
      case "followup":
        return needsFollowUp(item);
      case "comments":
        return Boolean(item.comment);
      case "quote":
        return Boolean(item.comment && item.quoteOk);
      case "handled":
        return isHandled(item);
      default:
        return true;
    }
  });

  function toggle(item: StoredFeedback) {
    const next = !isHandled(item);
    setHandledOverride((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      const result = await toggleFeedbackHandledAction(item.id);
      // Put it back if the server refused.
      if (!result.ok) setHandledOverride((prev) => ({ ...prev, [item.id]: !next }));
    });
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
        <h2 className="font-display text-lg font-semibold text-heading">Responses</h2>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter responses">
          {FILTERS.map((f) => {
            const count = items.filter((item) => {
              switch (f.id) {
                case "followup":
                  return needsFollowUp(item);
                case "comments":
                  return Boolean(item.comment);
                case "quote":
                  return Boolean(item.comment && item.quoteOk);
                case "handled":
                  return isHandled(item);
                default:
                  return true;
              }
            }).length;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f.id
                    ? "bg-ember-600 text-white"
                    : "bg-canvas text-muted hover:text-heading"
                }`}
              >
                {f.label} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {visible.map((item) => {
            const expanded = open === item.id;
            const handled = isHandled(item);
            const answerEntries = Object.entries(item.answers).filter(([id]) => id !== "recommend");

            return (
              <li key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tone(item.recommend)}`}
                        title="Would recommend Kebabish"
                      >
                        {item.recommend ?? "–"} / 5
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(item.createdAt).toLocaleString("en-GB", {
                          timeZone: "Europe/Amsterdam",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </span>
                      {item.orderId && item.orderReference && (
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="text-xs font-semibold text-ember-700 hover:underline"
                        >
                          {item.orderReference}
                        </Link>
                      )}
                      {item.quoteOk && item.comment && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ember-600/10 px-2 py-0.5 text-xs font-semibold text-ember-700">
                          <Quote size={11} /> OK to quote
                        </span>
                      )}
                      {handled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                          <Check size={11} /> Handled
                        </span>
                      )}
                    </div>

                    {item.dishes.length > 0 && (
                      <p className="mt-2 text-sm text-body-text">
                        {item.dishes.map((d) => d.name).join(", ")}
                        {item.favouriteSlug && (
                          <span className="text-muted">
                            {" "}
                            · favourite: {item.dishes.find((d) => d.slug === item.favouriteSlug)?.name}
                          </span>
                        )}
                      </p>
                    )}

                    {item.comment && (
                      <p className="mt-3 flex gap-2 rounded-xl bg-canvas p-3 text-sm leading-relaxed text-heading">
                        <MessageSquareQuote size={16} className="mt-0.5 shrink-0 text-faint" />
                        <span className="whitespace-pre-line">{item.comment}</span>
                      </p>
                    )}

                    {item.contactOk && item.contactEmail && (
                      <p className="mt-3 flex items-center gap-2 text-sm text-body-text">
                        <Mail size={14} className="text-faint" />
                        <span>
                          {item.contactName ? `${item.contactName} · ` : ""}
                          <a
                            href={`mailto:${item.contactEmail}`}
                            className="font-semibold text-ember-700 hover:underline"
                          >
                            {item.contactEmail}
                          </a>
                          <span className="text-muted"> — OK to contact</span>
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      disabled={pending}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        handled
                          ? "border border-hairline text-muted hover:text-heading"
                          : "bg-heading text-white hover:opacity-90"
                      }`}
                    >
                      {handled ? "Undo handled" : "Mark handled"}
                    </button>
                    {answerEntries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : item.id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? "Hide answers" : "Show answers"}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-xl border border-hairline p-4 text-sm sm:grid-cols-2">
                    {item.orderedBefore && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted">Has ordered before</dt>
                        <dd className="text-heading">
                          {labels.orderedBefore[item.orderedBefore] ?? item.orderedBefore}
                        </dd>
                      </div>
                    )}
                    {answerEntries.map(([id, value]) => (
                      <div key={id}>
                        <dt className="text-xs text-muted">{questionLabel(labels, id)}</dt>
                        <dd className="font-medium text-heading">
                          {value}/5 · {scaleLabel(labels, id, value)}
                        </dd>
                      </div>
                    ))}
                    {item.heardFrom && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted">How they found us</dt>
                        <dd className="text-heading">{labels.heard[item.heardFrom] ?? item.heardFrom}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
