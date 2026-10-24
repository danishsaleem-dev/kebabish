/**
 * The report range maths, checked without a database or a browser.
 *
 *   npx tsx scripts/check-reports.mts
 *
 * Run it after touching `src/lib/admin/report-range.ts`. The cases that matter are the ones a
 * calendar makes easy to get wrong: buckets clipped at both ends of the range, weeks that start
 * on Monday whatever day the range does, months of different lengths, and a "previous period"
 * that is the same number of days rather than the previous calendar month.
 */
import {
  addDaysKey,
  allowedGranularities,
  bucketsFor,
  dayCount,
  defaultGranularity,
  describeRange,
  matchPreset,
  normaliseRange,
  presetRange,
  previousRange,
} from "../src/lib/admin/report-range";

let pass = 0;
const fails: string[] = [];
function eq(name: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) pass++;
  else fails.push(`${name}: got ${a}, want ${b}`);
}

const TODAY = "2026-10-24"; // a Saturday

// --- day arithmetic
eq("step forward", addDaysKey("2026-10-24", 1), "2026-10-25");
eq("step over a month", addDaysKey("2026-10-31", 1), "2026-11-01");
eq("step back over a year", addDaysKey("2026-01-01", -1), "2025-12-31");
eq("leap day exists", addDaysKey("2028-02-28", 1), "2028-02-29");
eq("no leap day in 2026", addDaysKey("2026-02-28", 1), "2026-03-01");

// --- counting
eq("one day counts as one", dayCount({ from: TODAY, to: TODAY }), 1);
eq("a week counts as seven", dayCount({ from: "2026-10-18", to: "2026-10-24" }), 7);
eq("counts across DST", dayCount({ from: "2026-10-24", to: "2026-11-02" }), 10);

// --- presets
eq("today", presetRange("today", TODAY), { from: TODAY, to: TODAY });
eq("yesterday", presetRange("yesterday", TODAY), { from: "2026-10-23", to: "2026-10-23" });
eq("last 7 includes today", presetRange("last7", TODAY), { from: "2026-10-18", to: TODAY });
eq("last 7 is seven days", dayCount(presetRange("last7", TODAY)), 7);
eq("last 30 is thirty days", dayCount(presetRange("last30", TODAY)), 30);
eq("this month", presetRange("thisMonth", TODAY), { from: "2026-10-01", to: TODAY });
eq("last month", presetRange("lastMonth", TODAY), { from: "2026-09-01", to: "2026-09-30" });
eq("last month in March catches February", presetRange("lastMonth", "2026-03-10"), {
  from: "2026-02-01",
  to: "2026-02-28",
});
eq("last month in January crosses the year", presetRange("lastMonth", "2026-01-10"), {
  from: "2025-12-01",
  to: "2025-12-31",
});
eq("this year", presetRange("thisYear", TODAY), { from: "2026-01-01", to: TODAY });
eq("a preset recognises itself", matchPreset(presetRange("last7", TODAY), TODAY), "last7");
eq("a hand-picked range matches nothing", matchPreset({ from: "2026-10-10", to: "2026-10-15" }, TODAY), null);

// --- reversed selection
eq("backwards range is put right", normaliseRange("2026-10-20", "2026-10-10"), {
  from: "2026-10-10",
  to: "2026-10-20",
});

// --- granularity
eq("a fortnight is drawn in days", defaultGranularity({ from: "2026-10-11", to: "2026-10-24" }), "day");
eq("a quarter is drawn in weeks", defaultGranularity({ from: "2026-08-01", to: "2026-10-24" }), "week");
eq("a year is drawn in months", defaultGranularity(presetRange("thisYear", TODAY)), "month");
eq("one day offers only days", allowedGranularities({ from: TODAY, to: TODAY }), ["day"]);
eq("a month offers days and weeks", allowedGranularities({ from: "2026-09-25", to: "2026-10-24" }), [
  "day",
  "week",
]);
eq("a year offers all three", allowedGranularities(presetRange("thisYear", TODAY)), [
  "day",
  "week",
  "month",
]);

// --- buckets: days
const dayBuckets = bucketsFor({ from: "2026-10-22", to: "2026-10-24" }, "day");
eq("one bucket per day", dayBuckets.length, 3);
eq("a day bucket is that day", dayBuckets[0], {
  key: "2026-10-22",
  label: "22 Oct",
  from: "2026-10-22",
  to: "2026-10-22",
});

// --- buckets: weeks, clipped at both ends
// 2026-10-07 is a Wednesday; 2026-10-20 is a Tuesday.
const weekBuckets = bucketsFor({ from: "2026-10-07", to: "2026-10-20" }, "week");
eq("three part/whole weeks", weekBuckets.length, 3);
eq("first week starts at the range, not the Monday", weekBuckets[0].from, "2026-10-07");
eq("first week ends on its Sunday", weekBuckets[0].to, "2026-10-11");
eq("middle week is whole", [weekBuckets[1].from, weekBuckets[1].to], ["2026-10-12", "2026-10-18"]);
eq("last week stops at the range", weekBuckets[2].to, "2026-10-20");
eq("no day is in two buckets", weekBuckets[1].from, addDaysKey(weekBuckets[0].to, 1));
eq("no day is skipped", weekBuckets[2].from, addDaysKey(weekBuckets[1].to, 1));
eq("buckets cover exactly the range", [weekBuckets[0].from, weekBuckets.at(-1)!.to], [
  "2026-10-07",
  "2026-10-20",
]);

// --- buckets: months, clipped at both ends
const monthBuckets = bucketsFor({ from: "2026-08-15", to: "2026-10-10" }, "month");
eq("three months", monthBuckets.length, 3);
eq("first month starts at the range", monthBuckets[0].from, "2026-08-15");
eq("first month ends on the 31st", monthBuckets[0].to, "2026-08-31");
eq("whole middle month", [monthBuckets[1].from, monthBuckets[1].to], ["2026-09-01", "2026-09-30"]);
eq("last month stops at the range", monthBuckets[2].to, "2026-10-10");
eq("February is 28 days in 2026", bucketsFor({ from: "2026-02-01", to: "2026-03-05" }, "month")[0].to, "2026-02-28");
eq("months cross a year", bucketsFor({ from: "2025-12-01", to: "2026-01-31" }, "month").length, 2);

// Every day of a range lands in exactly one bucket, at every granularity.
for (const granularity of ["day", "week", "month"] as const) {
  const range = { from: "2026-07-03", to: "2026-10-24" };
  const buckets = bucketsFor(range, granularity);
  let covered = 0;
  for (let key = range.from; key <= range.to; key = addDaysKey(key, 1)) {
    covered += buckets.filter((b) => key >= b.from && key <= b.to).length;
  }
  eq(`every day in exactly one ${granularity} bucket`, covered, dayCount(range));
}

// --- previous period
eq("previous week is the week before", previousRange({ from: "2026-10-18", to: "2026-10-24" }), {
  from: "2026-10-11",
  to: "2026-10-17",
});
eq("previous day", previousRange({ from: TODAY, to: TODAY }), {
  from: "2026-10-23",
  to: "2026-10-23",
});
eq(
  "previous period has the same length, not the previous calendar month",
  dayCount(previousRange(presetRange("thisMonth", TODAY))),
  dayCount(presetRange("thisMonth", TODAY))
);

// --- labels
eq("a single day reads in full", describeRange({ from: TODAY, to: TODAY }), "Sat, 24 Oct 2026");
eq("a span inside a month", describeRange({ from: "2026-10-10", to: "2026-10-15" }), "10 – 15 Oct 2026");
eq("a span across months", describeRange({ from: "2026-09-28", to: "2026-10-04" }), "28 Sept – 4 Oct 2026");

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL " + f);
process.exit(fails.length ? 1 : 0);
