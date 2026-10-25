/**
 * Self-check for the editable-content layer. No database needed.
 *
 *   npx tsx scripts/check-content.mts
 *
 * Run it after touching messages/*.json, src/lib/content/registry.ts or model.ts.
 * It exists because the failure it guards against is silent and expensive: a key
 * in the registry that was renamed in the messages file would show an editor
 * field with no default, and a bad override reaching the renderer would turn a
 * text edit into a 500 on a public page.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ALL_FIELDS, GROUPS } from "../src/lib/content/registry";
import {
  HOME_SECTIONS,
  applyOverrides,
  checkField,
  getPath,
  isDefaultLayout,
  layoutWarnings,
  resolveLayout,
  type Messages,
} from "../src/lib/content/model";

const require = createRequire(import.meta.url);
const nl = JSON.parse(readFileSync("messages/nl.json", "utf8")) as Messages;
const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Messages;

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  FAIL  ${what}`);
  }
}

console.log(`Registry: ${GROUPS.length} groups, ${ALL_FIELDS.length} fields`);

// 1. Keys are unique, and every one exists in BOTH message files with the right shape.
const seen = new Set<string>();
for (const f of ALL_FIELDS) {
  ok(!seen.has(f.key), `duplicate key ${f.key}`);
  seen.add(f.key);
  for (const [loc, msgs] of [["nl", nl], ["en", en]] as const) {
    const def = getPath(msgs, f.key);
    if (f.kind === "text" || f.kind === "longtext") ok(typeof def === "string", `${loc}: ${f.key} should be a string, got ${typeof def}`);
    if (f.kind === "strings") ok(Array.isArray(def) && def.every((x) => typeof x === "string"), `${loc}: ${f.key} should be a string list`);
    if (f.kind === "faq") ok(Array.isArray(def) && def.every((x) => typeof x?.q === "string" && typeof x?.a === "string"), `${loc}: ${f.key} should be a Q/A list`);
  }
}

// 2. The shipped defaults must themselves pass the rules we enforce on edits —
//    otherwise "reset to default" could produce a value the editor would reject,
//    and a limit set too low would make the owner's untouched text look invalid.
for (const f of ALL_FIELDS) {
  for (const [loc, msgs] of [["nl", nl], ["en", en]] as const) {
    const def = getPath(msgs, f.key);
    const result = checkField(f.key, def, loc, msgs);
    ok(result.ok, `${loc}: default of ${f.key} fails its own rules — ${result.ok ? "" : result.error}`);
  }
}

// 3. Hostile / sloppy input is rejected with a message, never thrown.
const hostile: [string, unknown, string][] = [
  ["home.whyTitle", "Fresh {flavor} daily", "unknown placeholder"],
  ["home.whyTitle", "Fresh { daily", "unbalanced brace"],
  ["home.whyTitle", "We love <b>spice</b>", "html tag"],
  ["home.whyTitle", "{n, plural, one {a} other {b}}", "plural rule"],
  ["home.whyTitle", "", "empty"],
  ["home.whyTitle", "   ", "blank"],
  ["home.whyTitle", "x".repeat(500), "too long"],
  ["home.whyTitle", "Made by Marfah Enterprise", "legal name"],
  ["home.whyTitle", 42, "not a string"],
  ["home.whyTitle", null, "null"],
  ["home.marquee", [], "empty list"],
  ["home.marquee", "not a list", "wrong type"],
  ["home.marquee", ["ok", "Marfah"], "legal name in a list"],
  ["home.faq", [{ q: "Only a question", a: "" }], "half-filled FAQ row"],
  ["home.faq", [], "empty FAQ"],
  ["checkout.title", "anything", "key outside the registry"],
  ["privacy.intro", "anything", "legal text is not editable"],
  ["seo.deliveryDescription", "We deliver {radius} km to {towns} and {other}", "unknown placeholder in SEO"],
];
for (const [key, value, why] of hostile) {
  let result;
  try {
    result = checkField(key, value, "en", en);
  } catch (e) {
    ok(false, `${why}: THREW ${(e as Error).message}`);
    continue;
  }
  ok(!result.ok, `${why}: should have been rejected (${key})`);
}

// 4. Good input is accepted and tidied.
const good = checkField("home.whyTitle", "  Fresh\nand   fast  ", "en", en);
ok(good.ok && good.value === "Fresh and fast", `single-line text is tidied (got ${JSON.stringify(good)})`);
const para = checkField("home.aboutText", "Line one.\n\n\n\nLine two.", "en", en);
ok(para.ok && para.value === "Line one.\n\nLine two.", "paragraph keeps one blank line");
const withArgs = checkField("seo.deliveryDescription", "We deliver {radius} km around Hoogkarspel: {towns}.", "en", en);
ok(withArgs.ok, "a default placeholder can be reused");
const noArgs = checkField("seo.deliveryDescription", "We deliver around Hoogkarspel.", "en", en);
ok(noArgs.ok, "a default placeholder can be dropped");
const apostrophe = checkField("home.whyTitle", "We're the kitchen you'll love", "en", en);
ok(apostrophe.ok, "apostrophes are fine");
const faq = checkField("home.faq", [{ q: " Q one? ", a: "A one." }, { q: "", a: "" }], "en", en);
ok(faq.ok && Array.isArray(faq.value) && faq.value.length === 1, "an entirely empty FAQ row is dropped");

// 5. applyOverrides never throws, ignores junk, and applies what is valid.
const merged = applyOverrides(
  en,
  {
    "home.whyTitle": "A better headline",
    "home.marquee": ["One", "Two"],
    "home.faq": [{ q: "Q?", a: "A." }],
    // all of these must be ignored, not crash:
    "checkout.title": "hacked",
    "privacy.intro": "hacked",
    "home.aboutTitle": "Broken { brace",
    "home.aboutText": { not: "a string" },
    "home.categoriesTitle": "<script>alert(1)</script>",
    "nope.nothing": "x",
    "home.popularTitle": 123,
    "home.why1Title": "",
  },
  "en"
);
ok(getPath(merged, "home.whyTitle") === "A better headline", "valid text override applied");
ok(JSON.stringify(getPath(merged, "home.marquee")) === '["One","Two"]', "valid list override applied");
ok(getPath(merged, "checkout.title") === getPath(en, "checkout.title"), "key outside the registry is ignored");
ok(getPath(merged, "privacy.intro") === getPath(en, "privacy.intro"), "legal text cannot be overridden");
ok(getPath(merged, "home.aboutTitle") === getPath(en, "home.aboutTitle"), "broken ICU override is skipped");
ok(getPath(merged, "home.aboutText") === getPath(en, "home.aboutText"), "wrong-shape override is skipped");
ok(getPath(merged, "home.categoriesTitle") === getPath(en, "home.categoriesTitle"), "tag override is skipped");
ok(getPath(merged, "home.popularTitle") === getPath(en, "home.popularTitle"), "non-string override is skipped");
ok(getPath(merged, "home.why1Title") === getPath(en, "home.why1Title"), "empty override is skipped");
ok(getPath(en, "home.whyTitle") !== "A better headline", "the shipped messages are not mutated");
ok(getPath(merged, "nope.nothing") === undefined, "an override never invents a new path");

// 6. Real next-intl formatting of the merged messages — the thing that actually runs.
const { createTranslator } = require("use-intl/core");
const t = createTranslator({ locale: "en", messages: merged as never });
ok(t("home.whyTitle") === "A better headline", "next-intl renders the override");
ok(t("home.categoriesCount", { count: 3 }) === "3 dishes", "untouched plural strings still format");
ok(String(t("seo.deliveryDescription", { radius: 10, towns: "A, B" })).includes("10"), "placeholders still fill");

// 7. Homepage layout resolution.
const def = resolveLayout(undefined);
ok(isDefaultLayout(def), "no stored layout = the default order");
ok(def[0].id === "hero" && def[0].enabled, "hero is first and on");
const shuffled = resolveLayout([
  { id: "faq", enabled: true },
  { id: "hero", enabled: false }, // trying to hide the pinned banner
  { id: "ghost", enabled: true }, // an id that no longer exists
  { id: "faq", enabled: true }, // duplicate
  { id: "why", enabled: false },
]);
ok(shuffled[0].id === "hero" && shuffled[0].enabled, "pinned hero is forced first and on");
ok(!shuffled.some((e) => e.id === "ghost"), "unknown section ids are dropped");
ok(shuffled.filter((e) => e.id === "faq").length === 1, "duplicates are collapsed");
ok(shuffled.length === HOME_SECTIONS.length, "every section is present exactly once");
ok(shuffled.find((e) => e.id === "why")?.enabled === false, "a disabled section stays disabled");
ok(resolveLayout("garbage" as never).length === HOME_SECTIONS.length, "garbage in, full default out");
ok(resolveLayout([null, 5, "x"] as never).length === HOME_SECTIONS.length, "junk entries don't crash");

const none = new Set<string>();
ok(layoutWarnings(def, new Set(["showcase", "testimonials"])).length === 0, "the default order has no warnings");
const twoDark = resolveLayout(HOME_SECTIONS.map((s) => ({ id: s.id, enabled: true })));
// "How it works" and "Customer quotes" are both dark bands: put the quotes straight after it.
const howAt = twoDark.findIndex((e) => e.id === "how");
const tAt = twoDark.findIndex((e) => e.id === "testimonials");
[twoDark[tAt], twoDark[howAt + 1]] = [twoDark[howAt + 1], twoDark[tAt]];
ok(layoutWarnings(twoDark, none).some((w) => w.includes("dark")), "two dark bands touching is flagged");
const emptyOk = layoutWarnings(twoDark, new Set(["testimonials"]));
ok(!emptyOk.some((w) => w.includes("Customer quotes")), "a section that renders nothing is not counted");

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
