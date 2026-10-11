import en from "../../../messages/en.json";
import type { FeedbackLabels } from "@/lib/feedback/label-types";

/**
 * Human-readable text for the admin feedback screen.
 *
 * The admin panel sits outside the `[locale]` routing and is English-only (see
 * CLAUDE.md), so it can't use next-intl's per-request translations. The
 * questions are worded once, in `messages/*.json`, for the customer-facing
 * form — reading the English file here means the admin shows exactly the
 * sentence the customer was asked, and a reworded question can't drift between
 * the two.
 *
 * Only the feedback slice is handed to the browser (see `FeedbackLabels`): the
 * responses list is a Client Component, and importing the whole messages file
 * into it would ship every page's copy to every admin screen.
 */
export function getFeedbackLabels(): FeedbackLabels {
  const f = en.feedback;
  return {
    questions: f.questions as Record<string, string>,
    scale: f.scale as Record<string, string>,
    recommendScale: f.recommendScale as Record<string, string>,
    heard: f.heardOptions as Record<string, string>,
    orderedBefore: {
      ...(f.orderedBeforeOptions as Record<string, string>),
      order: "Ordered (came from an order link)",
    },
  };
}
