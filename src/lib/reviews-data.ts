/**
 * Real customer reviews Danish supplies directly — never invented copy.
 * Seeded empty; the /reviews page renders a graceful empty state until
 * entries land here. Swap this for a store-backed table if the list ever
 * needs to be editable without a code change.
 */
export interface Review {
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** e.g. "Google", "Facebook" — where the review was originally left. */
  source?: string;
}

export const reviews: Review[] = [];
