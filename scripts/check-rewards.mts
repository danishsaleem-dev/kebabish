/**
 * Checks for the Kebabish Punten rules (src/lib/rewards-math.ts). No database.
 * Run: npx tsx scripts/check-rewards.mts
 */
import {
  DEFAULT_REWARDS,
  clawbackPoints,
  earnedPoints,
  normalizeRewards,
  progressToReward,
  redemptionFor,
  valueOfPoints,
} from "../src/lib/rewards-math";

let failed = 0;
let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  }
}

const on = normalizeRewards({ enabled: true });

// Defaults: 10 points per €1, 1000 points = €5, so 5% back.
check("default rate", on.pointsPerEuro, 10);
check("default step", [on.redeemStepPoints, on.redeemStepCents], [1000, 500]);
check("default is off", DEFAULT_REWARDS.enabled, false);
check("5% back", (on.redeemStepCents / 100) / (on.redeemStepPoints / on.pointsPerEuro), 0.05);

// Earning
check("€25.98 food earns 259", earnedPoints(2598, 0, on), 259);
check("€26.00 earns 260", earnedPoints(2600, 0, on), 260);
check("discount is not rewarded", earnedPoints(2600, 500, on), 210);
check("discount bigger than food", earnedPoints(500, 900, on), 0);
check("nothing earns nothing", earnedPoints(0, 0, on), 0);
check("rounds down", earnedPoints(99, 0, on), 9);

// Spending
check("off switch", redemptionFor(5000, 10000, DEFAULT_REWARDS), { steps: 0, points: 0, cents: 0 });
check("too few points", redemptionFor(999, 10000, on), { steps: 0, points: 0, cents: 0 });
check("exactly one step", redemptionFor(1000, 10000, on), { steps: 1, points: 1000, cents: 500 });
check("two steps from 2500", redemptionFor(2500, 10000, on), { steps: 2, points: 2000, cents: 1000 });
// 30% of €20 = €6 -> one step of €5, even with plenty of points
check("share cap", redemptionFor(9000, 2000, on), { steps: 1, points: 1000, cents: 500 });
// 30% of €14 = €4.20 -> not even one €5 step
check("basket too small for a step", redemptionFor(9000, 1400, on), { steps: 0, points: 0, cents: 0 });
check("empty basket", redemptionFor(9000, 0, on), { steps: 0, points: 0, cents: 0 });
check("negative balance", redemptionFor(-5, 5000, on), { steps: 0, points: 0, cents: 0 });
const half = normalizeRewards({ enabled: true, maxSharePercent: 100 });
check("100% cap never exceeds the basket", redemptionFor(100_000, 1200, half).cents, 1000);

// Worth and progress
check("1000 points = €5", valueOfPoints(1000, on), 500);
check("1999 points are worth 999 cents (rounded down)", valueOfPoints(1999, on), 999);
check("0 points", valueOfPoints(0, on), 0);
check("progress partway", progressToReward(250, on), { canRedeem: false, toGo: 750, fraction: 0.25 });
check("progress enough", progressToReward(1200, on), { canRedeem: true, toGo: 0, fraction: 1 });

// Refund clawback
check("half refunded takes half", clawbackPoints(260, 260, 1300, 2600), 130);
check("full refund takes all", clawbackPoints(260, 260, 2600, 2600), 260);
check("never more than is left", clawbackPoints(260, 100, 2600, 2600), 100);
check("rounds to nearest", clawbackPoints(259, 259, 1000, 2598), 100);
check("refund larger than the order", clawbackPoints(260, 260, 9999, 2600), 260);
check("nothing earned", clawbackPoints(0, 0, 500, 2600), 0);
check("zero refund", clawbackPoints(260, 260, 0, 2600), 0);

// Stored junk becomes a usable config
check("undefined", normalizeRewards(undefined), DEFAULT_REWARDS);
check("junk numbers", normalizeRewards({ enabled: true, pointsPerEuro: Number.NaN, redeemStepPoints: -4 }).redeemStepPoints, 1);
check("junk NaN falls back", normalizeRewards({ enabled: true, pointsPerEuro: Number.NaN }).pointsPerEuro, 10);
check("only true enables", normalizeRewards({ enabled: "yes" as unknown as boolean }).enabled, false);
check("share clamps", normalizeRewards({ maxSharePercent: 500 }).maxSharePercent, 100);
check("welcome can be zero", normalizeRewards({ welcomePoints: 0 }).welcomePoints, 0);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
