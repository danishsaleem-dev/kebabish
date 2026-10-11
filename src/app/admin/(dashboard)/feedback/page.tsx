import { AlertTriangle, DatabaseZap } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import FeedbackResponses from "@/components/admin/FeedbackResponses";
import { listFeedback } from "@/lib/feedback/data";
import { summarise, type QuestionStat } from "@/lib/feedback/stats";
import { SCALE_QUESTIONS, type FeedbackSection } from "@/lib/feedback/questions";
import { getFeedbackLabels } from "@/lib/feedback/labels";
import { questionLabel } from "@/lib/feedback/label-types";

export const metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

const SECTIONS: { id: FeedbackSection; title: string }[] = [
  { id: "food", title: "The food" },
  { id: "delivery", title: "The delivery" },
  { id: "website", title: "The website" },
];

/** A 1-5 average as a colour: the same red/amber/green the rest of the panel uses. */
function averageTone(average: number | null) {
  if (average == null) return "text-faint";
  if (average < 3) return "text-danger";
  if (average < 4) return "text-warn";
  return "text-success";
}

const SEGMENT_COLOURS = ["bg-danger", "bg-warn/70", "bg-faint/50", "bg-success/60", "bg-success"];

export default async function FeedbackPage() {
  const { ready, items } = await listFeedback();
  const labels = getFeedbackLabels();

  if (!ready) {
    return (
      <AdminShell title="Feedback">
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <DatabaseZap size={22} />
          </span>
          <h2 className="font-display text-lg font-semibold text-heading">The feedback table isn&apos;t set up yet</h2>
          <p className="max-w-md text-sm text-muted">
            Run <code className="rounded bg-hairline px-1">supabase/migrations/0018_feedback.sql</code> once in the
            Supabase SQL editor. Until then the feedback form can&apos;t save anything.
          </p>
        </Card>
      </AdminShell>
    );
  }

  const summary = summarise(items);
  const byId = new Map(summary.questions.map((q) => [q.id, q]));

  const stats = [
    {
      label: "Responses",
      value: String(summary.total),
      hint: `${summary.withComment} with a comment`,
    },
    {
      label: "Would recommend",
      value: summary.recommendAverage != null ? `${summary.recommendAverage.toFixed(1)} / 5` : "–",
      hint: summary.happyPercent != null ? `${summary.happyPercent}% answered 4 or 5` : undefined,
      tone: averageTone(summary.recommendAverage),
    },
    {
      label: "Needs follow-up",
      value: String(summary.needsFollowUp),
      hint: "Unhappy and not yet handled",
      tone: summary.needsFollowUp > 0 ? "text-danger" : "text-success",
    },
    {
      label: "OK to quote",
      value: String(summary.quotable),
      hint: "Comments you may show on the site",
    },
  ];

  return (
    <AdminShell title="Feedback">
      <div className="space-y-4 sm:space-y-6">
        <Card padded={false}>
          <div className="grid divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="p-5">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className={`mt-1.5 font-display text-2xl font-semibold ${stat.tone ?? "text-heading"}`}>
                  {stat.value}
                </p>
                {stat.hint && <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>}
              </div>
            ))}
          </div>
        </Card>

        {summary.needsFollowUp > 0 && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            <AlertTriangle size={16} />
            {summary.needsFollowUp} unhappy customer{summary.needsFollowUp === 1 ? "" : "s"} still need a follow-up.
            Use the &ldquo;Needs follow-up&rdquo; filter below.
          </p>
        )}

        {summary.total === 0 ? (
          <Card className="py-12 text-center">
            <h2 className="font-display text-lg font-semibold text-heading">No feedback yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Customers are invited to give feedback in their delivered-order email, on their account page and order
              page, and from the footer. Share <code className="rounded bg-hairline px-1">kebabish.nl/feedback?src=packaging</code>{" "}
              as a QR code or sticker on the bag to count responses from your packaging separately.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader
                  title="By question"
                  subtitle="Average out of 5, with how many chose each answer (1 on the left, 5 on the right)."
                />
                <div className="mt-5 space-y-6">
                  <Question stat={summary.recommend} label={questionLabel(labels, "recommend")} />
                  {SECTIONS.map((section) => (
                    <div key={section.id}>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {section.title}
                      </h3>
                      <div className="mt-3 space-y-4">
                        {SCALE_QUESTIONS.filter((q) => q.section === section.id).map((q) => {
                          const stat = byId.get(q.id);
                          return stat ? (
                            <Question key={q.id} stat={stat} label={questionLabel(labels, q.id)} />
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader title="Dishes" subtitle="Mentioned in feedback, and named favourite." />
                  {summary.dishes.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No dishes picked yet.</p>
                  ) : (
                    <table className="mt-4 w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="pb-2 font-medium">Dish</th>
                          <th className="pb-2 text-right font-medium">Mentions</th>
                          <th className="pb-2 text-right font-medium">Favourite</th>
                          <th className="pb-2 text-right font-medium">Taste</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {summary.dishes.slice(0, 12).map((dish) => (
                          <tr key={dish.slug}>
                            <td className="py-2 pr-2 text-heading">{dish.name}</td>
                            <td className="py-2 text-right tabular-nums">{dish.mentions}</td>
                            <td className="py-2 text-right tabular-nums">{dish.favourites || "–"}</td>
                            <td className={`py-2 text-right tabular-nums font-medium ${averageTone(dish.taste)}`}>
                              {dish.taste != null ? dish.taste.toFixed(1) : "–"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                {summary.heardFrom.length > 0 && (
                  <Card>
                    <CardHeader title="How people found us" />
                    <ul className="mt-4 space-y-2 text-sm">
                      {summary.heardFrom.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-3">
                          <span className="text-body-text">{labels.heard[h.id] ?? h.id}</span>
                          <span className="font-semibold tabular-nums text-heading">{h.count}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>

            <FeedbackResponses items={items} labels={labels} />
          </>
        )}
      </div>
    </AdminShell>
  );
}

/** One question: its average, and a five-segment bar of how the answers split. */
function Question({ stat, label }: { stat: QuestionStat; label: string }) {
  const max = Math.max(1, ...stat.distribution);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-heading">{label}</p>
        <p className={`shrink-0 font-display text-base font-semibold tabular-nums ${averageTone(stat.average)}`}>
          {stat.average != null ? stat.average.toFixed(1) : "–"}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden="true">
        {stat.distribution.map((count, i) => (
          <div key={i} className="flex h-8 items-end rounded bg-canvas" title={`${count} answered ${i + 1}`}>
            <div
              className={`w-full rounded ${SEGMENT_COLOURS[i]}`}
              style={{ height: `${count === 0 ? 0 : Math.max(12, (count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[0.65rem] tabular-nums text-faint">
        {stat.distribution.map((count, i) => (
          <span key={i}>{count}</span>
        ))}
      </div>
      <p className="sr-only">
        {stat.answered} answers, average {stat.average?.toFixed(1) ?? "none"} out of 5
      </p>
    </div>
  );
}
