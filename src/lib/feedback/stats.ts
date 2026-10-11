import {
  HAPPY_AT_OR_ABOVE,
  RECOMMEND_ID,
  SCALE_QUESTIONS,
  SCALE_VALUES,
  UNHAPPY_AT_OR_BELOW,
} from "@/lib/feedback/questions";

/**
 * Turning a pile of submissions into the handful of numbers the owner acts on.
 * Pure functions over plain data (no database, no server imports), so the admin
 * page can compute them once on the server and a test can feed them anything.
 *
 * Deliberately simple: averages and counts, not a "satisfaction score" with its
 * own formula. With a few hundred responses at most, an average out of 5 and
 * "how many were happy" is what can be read at a glance and trusted.
 */

/** The subset of a feedback row the statistics need. */
export interface FeedbackLike {
  answers: Record<string, number>;
  recommend: number | null;
  dishes: { slug: string; name: string }[];
  favouriteSlug: string | null;
  comment: string | null;
  quoteOk: boolean;
  handledAt: string | null;
  heardFrom: string | null;
}

export interface QuestionStat {
  id: string;
  /** Average out of 5, or null when nobody answered it. */
  average: number | null;
  answered: number;
  /** distribution[0] is the number of 1s ... distribution[4] the number of 5s. */
  distribution: number[];
}

export interface DishStat {
  slug: string;
  name: string;
  /** How many feedback submissions mention this dish. */
  mentions: number;
  /** How many named it as their favourite. */
  favourites: number;
  /** Average "the taste was what I hoped for" among those who mention it. */
  taste: number | null;
}

export interface FeedbackSummary {
  total: number;
  /** Average "would recommend", out of 5. */
  recommendAverage: number | null;
  /** Share of respondents who answered 4 or 5, 0..100. */
  happyPercent: number | null;
  /** Unhappy (<=2) and nobody has followed up yet. */
  needsFollowUp: number;
  withComment: number;
  quotable: number;
  questions: QuestionStat[];
  recommend: QuestionStat;
  dishes: DishStat[];
  heardFrom: { id: string; count: number }[];
}

function statFor(id: string, rows: FeedbackLike[], read: (row: FeedbackLike) => number | undefined): QuestionStat {
  const distribution = SCALE_VALUES.map(() => 0);
  let sum = 0;
  let answered = 0;
  for (const row of rows) {
    const value = read(row);
    if (typeof value === "number" && value >= 1 && value <= 5) {
      distribution[value - 1] += 1;
      sum += value;
      answered += 1;
    }
  }
  return { id, average: answered ? sum / answered : null, answered, distribution };
}

export function summarise(rows: FeedbackLike[]): FeedbackSummary {
  const recommend = statFor(RECOMMEND_ID, rows, (r) => r.recommend ?? r.answers[RECOMMEND_ID]);
  const happy = recommend.distribution.slice(HAPPY_AT_OR_ABOVE - 1).reduce((a, b) => a + b, 0);

  const dishMap = new Map<string, { name: string; mentions: number; favourites: number; taste: number[] }>();
  for (const row of rows) {
    for (const dish of row.dishes) {
      const entry = dishMap.get(dish.slug) ?? { name: dish.name, mentions: 0, favourites: 0, taste: [] };
      entry.mentions += 1;
      if (row.favouriteSlug === dish.slug) entry.favourites += 1;
      const taste = row.answers.taste;
      if (typeof taste === "number") entry.taste.push(taste);
      dishMap.set(dish.slug, entry);
    }
  }

  const heard = new Map<string, number>();
  for (const row of rows) {
    if (row.heardFrom) heard.set(row.heardFrom, (heard.get(row.heardFrom) ?? 0) + 1);
  }

  return {
    total: rows.length,
    recommendAverage: recommend.average,
    happyPercent: recommend.answered ? Math.round((happy / recommend.answered) * 100) : null,
    needsFollowUp: rows.filter(
      (r) => (r.recommend ?? 99) <= UNHAPPY_AT_OR_BELOW && !r.handledAt
    ).length,
    withComment: rows.filter((r) => r.comment).length,
    quotable: rows.filter((r) => r.comment && r.quoteOk).length,
    questions: SCALE_QUESTIONS.map((q) => statFor(q.id, rows, (r) => r.answers[q.id])),
    recommend,
    dishes: [...dishMap.entries()]
      .map(([slug, e]) => ({
        slug,
        name: e.name,
        mentions: e.mentions,
        favourites: e.favourites,
        taste: e.taste.length ? e.taste.reduce((a, b) => a + b, 0) / e.taste.length : null,
      }))
      .sort((a, b) => b.mentions - a.mentions || b.favourites - a.favourites),
    heardFrom: [...heard.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
  };
}
