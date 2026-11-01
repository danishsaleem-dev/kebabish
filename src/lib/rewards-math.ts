/**
 * Kebabish Punten: the rules, as pure functions.
 *
 * No database and no server-only imports, so the checkout form (browser) and the server
 * action use the very same arithmetic and cannot disagree about what a basket earns or what
 * points are worth. Money is integer cents throughout; points are whole numbers.
 *
 * The default rates: 10 points for every €1 of food, and 1,000 points = €5 off. That gives
 * back 5% of what a member spends. Change the rates in /admin/rewards, not here.
 */

export interface RewardsConfig {
  /** The master switch. Off = nothing is earned, shown or spent. */
  enabled: boolean;
  /** Points earned for every €1 of food (after any discount). */
  pointsPerEuro: number;
  /** Points one "step" of money off costs. */
  redeemStepPoints: number;
  /** Money off, in cents, that one step buys. */
  redeemStepCents: number;
  /** Points may cover at most this percentage of the food total on an order. */
  maxSharePercent: number;
  /** One-off bonus with a customer's first rewarded order. 0 = none. */
  welcomePoints: number;
}

export const DEFAULT_REWARDS: RewardsConfig = {
  enabled: false,
  pointsPerEuro: 10,
  redeemStepPoints: 1000,
  redeemStepCents: 500,
  maxSharePercent: 30,
  welcomePoints: 500,
};

function wholeInRange(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Whatever is stored (possibly nothing, possibly junk) becomes a usable config. */
export function normalizeRewards(raw: Partial<RewardsConfig> | null | undefined): RewardsConfig {
  const d = DEFAULT_REWARDS;
  return {
    enabled: raw?.enabled === true,
    pointsPerEuro: wholeInRange(raw?.pointsPerEuro, 1, 1000, d.pointsPerEuro),
    redeemStepPoints: wholeInRange(raw?.redeemStepPoints, 1, 1_000_000, d.redeemStepPoints),
    redeemStepCents: wholeInRange(raw?.redeemStepCents, 1, 100_000, d.redeemStepCents),
    maxSharePercent: wholeInRange(raw?.maxSharePercent, 1, 100, d.maxSharePercent),
    welcomePoints: wholeInRange(raw?.welcomePoints, 0, 100_000, d.welcomePoints),
  };
}

/** Points an order earns: on the food, after any discount, never on delivery. */
export function earnedPoints(foodCents: number, discountCents: number, config: RewardsConfig): number {
  const net = Math.max(Math.trunc(foodCents) - Math.trunc(discountCents), 0);
  return Math.floor((net * config.pointsPerEuro) / 100);
}

export interface Redemption {
  /** How many whole steps are being used. */
  steps: number;
  points: number;
  /** Money off, in cents. */
  cents: number;
}

const NONE: Redemption = { steps: 0, points: 0, cents: 0 };

/**
 * The most money off a basket can take from `available` points: whole steps only, never more
 * than the balance, and never more than `maxSharePercent` of the food total (so points can't
 * make a basket free).
 */
export function redemptionFor(
  available: number,
  foodCents: number,
  config: RewardsConfig
): Redemption {
  if (!config.enabled || available <= 0 || foodCents <= 0) return NONE;
  const byBalance = Math.floor(available / config.redeemStepPoints);
  const capCents = Math.floor((foodCents * config.maxSharePercent) / 100);
  const byCap = Math.floor(capCents / config.redeemStepCents);
  const steps = Math.max(0, Math.min(byBalance, byCap));
  if (steps === 0) return NONE;
  return {
    steps,
    points: steps * config.redeemStepPoints,
    cents: steps * config.redeemStepCents,
  };
}

/** What a number of points is worth in cents, rounded down. */
export function valueOfPoints(points: number, config: RewardsConfig): number {
  if (points <= 0) return 0;
  return Math.floor((points * config.redeemStepCents) / config.redeemStepPoints);
}

export interface Progress {
  /** Enough for at least one step. */
  canRedeem: boolean;
  /** Points still needed for the first step (0 once there are enough). */
  toGo: number;
  /** 0..1 towards the first step, for a progress bar. */
  fraction: number;
}

export function progressToReward(balance: number, config: RewardsConfig): Progress {
  const b = Math.max(balance, 0);
  const canRedeem = b >= config.redeemStepPoints;
  return {
    canRedeem,
    toGo: canRedeem ? 0 : config.redeemStepPoints - b,
    fraction: Math.min(b / config.redeemStepPoints, 1),
  };
}

/**
 * Points to take back when `refundCents` of an order worth `orderTotalCents` is refunded:
 * the same share of what the order earned, rounded to the nearest point and never more than
 * is left.
 */
export function clawbackPoints(
  earned: number,
  stillEarned: number,
  refundCents: number,
  orderTotalCents: number
): number {
  if (earned <= 0 || stillEarned <= 0 || refundCents <= 0 || orderTotalCents <= 0) return 0;
  const share = Math.round((earned * Math.min(refundCents, orderTotalCents)) / orderTotalCents);
  return Math.max(0, Math.min(share, stillEarned));
}
