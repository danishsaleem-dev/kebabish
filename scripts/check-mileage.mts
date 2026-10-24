/**
 * The rider mileage arithmetic, checked without a database or a browser.
 *
 *   npx tsx scripts/check-mileage.mts
 *
 * Run it after touching `src/lib/rider-mileage.ts`. The point of the cross-check is that its
 * lower bound is *physically* a lower bound, so the cases below pin that down: the floor is the
 * furthest delivery there and back, a round exactly at the floor is fine, and nothing is ever
 * flagged for being long.
 */
import {
  compareToEstimate,
  estimateStraightLine,
  parseOdometer,
  shiftKm,
} from "../src/lib/rider-mileage";

let pass = 0;
const fails: string[] = [];
function eq(name: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) pass++;
  else fails.push(`${name}: got ${a}, want ${b}`);
}

// shiftKm
eq("driven", shiftKm(48210, 48242), 32);
eq("no start", shiftKm(null, 48242), null);
eq("no end", shiftKm(48210, null), null);
eq("end before start", shiftKm(48242, 48210), null);
eq("same reading = zero", shiftKm(48210, 48210), 0);
eq("NaN", shiftKm(Number.NaN, 10), null);

// estimateStraightLine
eq("no deliveries", estimateStraightLine([]), null);
eq("one at 5km", estimateStraightLine([5]), { lowKm: 10, highKm: 10, stops: 1, unlocated: 0 });
eq("three", estimateStraightLine([2, 5, 3]), { lowKm: 10, highKm: 20, stops: 3, unlocated: 0 });
eq("low is furthest*2", estimateStraightLine([1, 1, 9])!.lowKm, 18);
eq("high is sum*2", estimateStraightLine([1, 1, 9])!.highKm, 22);
eq("rounds to 1dp", estimateStraightLine([1.23]), { lowKm: 2.5, highKm: 2.5, stops: 1, unlocated: 0 });
eq("unlocated carried", estimateStraightLine([4], 3)!.unlocated, 3);
eq("junk dropped", estimateStraightLine([Number.NaN, -1, 4])!.stops, 1);
eq("all junk", estimateStraightLine([Number.NaN, -1]), null);
eq("zero distance counts", estimateStraightLine([0]), { lowKm: 0, highKm: 0, stops: 1, unlocated: 0 });

// compareToEstimate
const est = estimateStraightLine([2, 5, 3])!; // low 10, high 20
eq("no reading", compareToEstimate(null, est), "noReading");
eq("no estimate", compareToEstimate(32, null), "noEstimate");
eq("below the floor", compareToEstimate(8, est), "belowStraightLine");
eq("exactly the floor is fine", compareToEstimate(10, est), "plausible");
eq("above the ceiling is fine", compareToEstimate(60, est), "plausible");
eq("a hair under tolerated", compareToEstimate(9.98, est), "plausible");

// parseOdometer
eq("plain", parseOdometer("48210"), 48210);
eq("spaces", parseOdometer("  48210 "), 48210);
eq("comma decimal rounded", parseOdometer("48210,6"), 48211);
eq("empty", parseOdometer(""), null);
eq("letters", parseOdometer("abc"), null);
eq("negative", parseOdometer("-5"), null);
eq("absurd", parseOdometer("9999999"), null);
eq("zero allowed", parseOdometer("0"), 0);
eq("number input", parseOdometer(123), 123);
eq("nothing", parseOdometer(null), null);

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL " + f);
process.exit(fails.length ? 1 : 0);
