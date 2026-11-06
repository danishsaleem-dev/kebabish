/**
 * The customer dashboard's copy, checked without a database or a browser.
 *
 * Why this exists: the dashboard lives outside `[locale]` and is not in the
 * editable-content registry, so `check-content.mts` never looks at it. A key
 * referenced in the code but missing from `messages/*.json` makes next-intl
 * *throw* while the page renders — the customer gets the error page, not a
 * missing word. That is exactly what happened to `ordersEmptyCta` while this
 * screen was being built, and it was only caught by opening the page.
 *
 *   npx tsx scripts/check-account-copy.mts
 *
 * Run it after touching anything under src/app/dashboard,
 * src/components/dashboard, src/lib/account-*.ts or the `account` namespace.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import IntlMessageFormat from "intl-messageformat";

const NAMESPACE = "account";

/** Where `t("…")` calls for this namespace can appear. */
const SOURCES = [
  "src/app/dashboard",
  "src/components/dashboard",
  "src/lib/account-view.ts",
];

let checks = 0;
let failed = 0;

function check(ok: boolean, what: string): void {
  checks += 1;
  if (!ok) {
    failed += 1;
    console.error(`  FAIL  ${what}`);
  }
}

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((entry) => files(join(path, entry)));
}

/** `t("key")` and `t.raw("key")`, which is how every string in these files is read. */
function referencedKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const path of SOURCES.flatMap(files)) {
    if (!/\.tsx?$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/\bt(?:\.raw)?\(\s*"([A-Za-z0-9_]+)"/g)) {
      if (!found.has(match[1])) found.set(match[1], path);
    }
    // `t(condition ? "a" : "b")` — the ternary form the actions use.
    for (const match of source.matchAll(/\bt\([^)"]*\?\s*"([A-Za-z0-9_]+)"\s*:\s*"([A-Za-z0-9_]+)"/g)) {
      for (const key of [match[1], match[2]]) if (!found.has(key)) found.set(key, path);
    }
  }
  return found;
}

function load(locale: "nl" | "en"): Record<string, unknown> {
  const all = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
  const block = all[NAMESPACE];
  if (!block) throw new Error(`messages/${locale}.json has no "${NAMESPACE}" namespace`);
  return block;
}

const nl = load("nl");
const en = load("en");
const used = referencedKeys();

console.log(`${NAMESPACE}: ${Object.keys(nl).length} keys, ${used.size} referenced in code\n`);

// 1. Every key the code asks for exists in both languages. A miss throws at render.
for (const [key, path] of used) {
  check(key in nl, `messages/nl.json is missing "${NAMESPACE}.${key}" (used in ${path})`);
  check(key in en, `messages/en.json is missing "${NAMESPACE}.${key}" (used in ${path})`);
}

// 2. The two files describe the same thing. A key in one and not the other is
//    a half-done translation that only shows up in the language nobody tested.
for (const key of Object.keys(nl)) check(key in en, `messages/en.json is missing "${key}"`);
for (const key of Object.keys(en)) check(key in nl, `messages/nl.json is missing "${key}"`);

// 3. Nothing defined and never used — dead copy that translators still pay for.
for (const key of Object.keys(nl)) {
  check(used.has(key), `"${NAMESPACE}.${key}" is defined but never used`);
}

// 4. Every value is valid ICU in its own locale, and both languages take the
//    same placeholders — an English string that forgot {points} would render
//    a sentence with a hole in it.
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]).sort();
}

for (const [key, value] of Object.entries(nl)) {
  const dutch = String(value);
  const english = String(en[key] ?? "");

  check(dutch.trim().length > 0, `"${key}" is empty in nl`);
  check(english.trim().length > 0, `"${key}" is empty in en`);

  for (const [locale, text] of [
    ["nl", dutch],
    ["en", english],
  ] as const) {
    let parsed = true;
    try {
      new IntlMessageFormat(text, locale === "nl" ? "nl-NL" : "en-GB");
    } catch {
      parsed = false;
    }
    check(parsed, `"${key}" is not valid ICU in ${locale}: ${text}`);
  }

  check(
    placeholders(dutch).join(",") === placeholders(english).join(","),
    `"${key}" uses different placeholders: nl [${placeholders(dutch)}] vs en [${placeholders(english)}]`
  );

  // The public-site rule: the legal entity is named only on Privacy and Terms.
  check(!/marfah/i.test(dutch), `"${key}" names Marfah in nl`);
  check(!/marfah/i.test(english), `"${key}" names Marfah in en`);
}

console.log(`${checks} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
