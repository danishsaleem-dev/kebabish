/**
 * Checks for the measurement chart's rules (src/lib/measurements.ts). No database needed.
 *   npx tsx scripts/check-measurements.mts
 */
import { gramsFor, measurementName, ratioLooksOff, spoonRatio } from "@/lib/measurements";

let checks = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

// Real rows from the chart.
const ajwain = { gramsPerTbsp: 7.74, gramsPerTsp: 2.68 };
const paprika = { gramsPerTbsp: 8.06, gramsPerTsp: 3.72 };
const salt = { gramsPerTbsp: 17.28, gramsPerTsp: 6.29 };
const onion = { gramsPerTbsp: 9.46, gramsPerTsp: 2.75 };
const cinnamonSticks = {}; // "—" on the chart

check("ratio ajwain 2.89", spoonRatio(ajwain) === 2.89, spoonRatio(ajwain));
check("ratio salt 2.75", spoonRatio(salt) === 2.75);
check("no spoons = no ratio", spoonRatio(cinnamonSticks) === null);
check("one spoon only = no ratio", spoonRatio({ gramsPerTbsp: 5 }) === null);
check("ajwain looks fine", !ratioLooksOff(ajwain));
check("salt looks fine", !ratioLooksOff(salt));
check("paprika 2.17 is flagged (tablespoon is 3 teaspoons)", ratioLooksOff(paprika));
check("onion powder 3.44 is inside the band", !ratioLooksOff(onion));
check("band edges: 2.5 ok, 3.5 ok", !ratioLooksOff({ gramsPerTbsp: 2.5, gramsPerTsp: 1 }) && !ratioLooksOff({ gramsPerTbsp: 3.5, gramsPerTsp: 1 }));
check("just outside: 2.49 and 3.51 flagged", ratioLooksOff({ gramsPerTbsp: 2.49, gramsPerTsp: 1 }) && ratioLooksOff({ gramsPerTbsp: 3.51, gramsPerTsp: 1 }));
check("nothing to flag without both readings", !ratioLooksOff({ gramsPerTsp: 3 }));

check("2 tsp of ajwain = 5.36 g", gramsFor(ajwain, "tsp", 2) === 5.36, gramsFor(ajwain, "tsp", 2));
check("half a tbsp of salt = 8.64 g", gramsFor(salt, "tbsp", 0.5) === 8.64, gramsFor(salt, "tbsp", 0.5));
check("a spoon that wasn't measured is null, not 0", gramsFor({ gramsPerTsp: 2 }, "tbsp", 1) === null);
check("unmeasured ingredient is null", gramsFor(cinnamonSticks, "tsp", 1) === null);
check("negative / NaN counts are refused", gramsFor(ajwain, "tsp", -1) === null && gramsFor(ajwain, "tsp", Number.NaN) === null);
check("zero spoons is zero grams", gramsFor(ajwain, "tsp", 0) === 0);

const names = new Map([["ajwain", "Ajwain"]]);
check("linked row shows the ingredient's name", measurementName({ nameEn: "Ajwain Seeds", ingredientId: "ajwain" }, names) === "Ajwain");
check("unlinked row shows the chart's name", measurementName({ nameEn: "Star Anise" }, names) === "Star Anise");
check("a link to a vanished ingredient falls back to the chart's name", measurementName({ nameEn: "Mace", ingredientId: "gone" }, names) === "Mace");

console.log(`${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
