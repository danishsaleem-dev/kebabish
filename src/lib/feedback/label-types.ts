/**
 * The shape of the admin feedback screen's text, and the two lookups over it.
 *
 * Split from `labels.ts` on purpose: that file reads the whole English messages
 * file, so anything importing it from a Client Component would pull every
 * page's copy into the browser. This one has no imports and is safe on either
 * side.
 */
export interface FeedbackLabels {
  questions: Record<string, string>;
  scale: Record<string, string>;
  recommendScale: Record<string, string>;
  heard: Record<string, string>;
  orderedBefore: Record<string, string>;
}

export const questionLabel = (labels: FeedbackLabels, id: string) => labels.questions[id] ?? id;

/** "Strongly agree" for a 1-5 value, using the recommend wording for that question. */
export function scaleLabel(labels: FeedbackLabels, questionId: string, value: number): string {
  const scale = questionId === "recommend" ? labels.recommendScale : labels.scale;
  return scale[String(value)] ?? String(value);
}
