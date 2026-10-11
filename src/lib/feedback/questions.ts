/**
 * The feedback questionnaire, defined once.
 *
 * Kept free of Node/server imports so the form (a Client Component), the
 * server action that validates it, and the admin screen that reports on it all
 * read the same list — a question can't exist in the form and be unknown to
 * the validator, or the other way round.
 *
 * The wording is in `messages/*.json` under `feedback.questions.<id>`; this
 * file only says *what* is asked and *to whom*.
 *
 * Why this set, and why it is this long: it is nine rating questions, but
 * grouped into four short steps of two or three, only the last one is
 * required, and a first-time visitor who has not ordered yet skips straight
 * to the website ones. The aim is the owner's four real questions —
 * is the food good, is delivery reliable, is ordering easy, would you tell a
 * friend — answered by as many people as possible, not the most data from the
 * few who have the patience.
 */

/** 1 = lowest, 5 = highest. Labels live in messages (`feedback.scale.*`). */
export const SCALE_VALUES = [1, 2, 3, 4, 5] as const;
export type ScaleValue = (typeof SCALE_VALUES)[number];

export type FeedbackSection = "food" | "delivery" | "website";

export interface ScaleQuestion {
  id: string;
  section: FeedbackSection;
  /** True when it only makes sense for someone who has actually received an order. */
  needsOrder: boolean;
}

export const SCALE_QUESTIONS: readonly ScaleQuestion[] = [
  // The food
  { id: "fresh", section: "food", needsOrder: true },
  { id: "taste", section: "food", needsOrder: true },
  { id: "value", section: "food", needsOrder: true },
  // The delivery
  { id: "ontime", section: "delivery", needsOrder: true },
  { id: "correct", section: "delivery", needsOrder: true },
  { id: "courier", section: "delivery", needsOrder: true },
  // The website
  { id: "easy", section: "website", needsOrder: false },
  { id: "menu", section: "website", needsOrder: false },
] as const;

export const SCALE_QUESTION_IDS = SCALE_QUESTIONS.map((q) => q.id);

export function questionsFor(section: FeedbackSection): ScaleQuestion[] {
  return SCALE_QUESTIONS.filter((q) => q.section === section);
}

/** The one required question, and the headline number everything else hangs off. */
export const RECOMMEND_ID = "recommend";

/** Recommend scores at or below this are an unhappy customer worth a call. */
export const UNHAPPY_AT_OR_BELOW = 2;
/** At or above this a customer is happy enough to be asked for a public review. */
export const HAPPY_AT_OR_ABOVE = 4;

export const ORDERED_BEFORE_OPTIONS = ["many", "once", "never"] as const;
export type OrderedBefore = (typeof ORDERED_BEFORE_OPTIONS)[number] | "order";

export const HEARD_FROM_OPTIONS = ["search", "social", "friends", "flyer", "other"] as const;
export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number];

/**
 * Where a visit to the form came from. A fixed list — the value comes from a
 * query string anyone can edit, so anything else collapses to "direct".
 * "packaging" is for a QR code or sticker on the bag: kebabish.nl/feedback?src=packaging.
 */
export const FEEDBACK_SOURCES = [
  "email",
  "dashboard",
  "confirmation",
  "footer",
  "contact",
  "packaging",
  "direct",
] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export function parseSource(value: string | undefined): FeedbackSource {
  return (FEEDBACK_SOURCES as readonly string[]).includes(value ?? "")
    ? (value as FeedbackSource)
    : "direct";
}

export const COMMENT_MAX = 1000;

/** What the form hands the server action. Plain data, so it crosses the boundary. */
export interface FeedbackPayload {
  /** Order reference and its signed token — both or neither. */
  reference?: string;
  token?: string;
  source: string;
  locale: string;
  orderedBefore?: string;
  dishes: string[];
  favourite?: string;
  answers: Record<string, number>;
  heardFrom?: string;
  comment?: string;
  contactOk: boolean;
  contactName?: string;
  contactEmail?: string;
  quoteOk: boolean;
  /** Honeypot: a real person never sees this field, so it must arrive empty. */
  website?: string;
}
