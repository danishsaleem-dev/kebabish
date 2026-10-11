#!/usr/bin/env node
/**
 * Restore a Kebabish backup file (Settings -> Backup) into a Supabase database.
 *
 *   node scripts/restore-backup.mjs <backup.json>                 dry run: shows what it WOULD do
 *   node scripts/restore-backup.mjs <backup.json> --apply         really restore
 *
 * Options
 *   --only=orders,order_items   restore just these tables
 *   --allow-nonempty            allow restoring into tables that already hold rows
 *
 * It talks to whatever project NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * (from .env / .env.local) point at, and prints that before doing anything.
 *
 * ## Before you run it for real
 * 1. The target database needs the schema: run every file in supabase/migrations/
 *    (0001 ... latest) in order in the Supabase SQL editor. This script restores
 *    rows, not tables.
 * 2. Prefer an EMPTY database (a new project). Restoring is an upsert: a row in the
 *    backup replaces the same row in the database. Into a database that has moved
 *    on since the backup, that would put OLD values over NEWER ones — which is why
 *    it refuses a non-empty target unless you pass --allow-nonempty.
 *
 * ## What it does about passwords
 * Backups carry no password hashes. Rows that need one are inserted with an
 * unusable placeholder, so those people use "forgot password". An existing row's
 * real hash is never touched (the update step doesn't include it).
 *
 * ## What it can't restore
 * Uploaded photos/videos (Supabase Storage). The records and URLs come back; the
 * image files must be re-uploaded from your originals.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

if (!file) {
  console.error("Usage: node scripts/restore-backup.mjs <backup.json> [--apply] [--only=a,b] [--allow-nonempty]");
  process.exit(1);
}

// ---- environment ----------------------------------------------------------
const env = { ...process.env };
for (const path of [".env", ".env.local"]) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env).");
  process.exit(1);
}

// ---- the file --------------------------------------------------------------
let backup;
try {
  backup = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Could not read ${file}: ${error.message}`);
  process.exit(1);
}
if (backup.app !== "kebabish" || backup.format !== 1 || typeof backup.tables !== "object") {
  console.error("This doesn't look like a Kebabish backup (wrong app/format). Nothing was changed.");
  process.exit(1);
}

const only = option("only")?.split(",").map((s) => s.trim());
const names = Object.keys(backup.tables).filter((n) => !only || only.includes(n));
if (only) {
  const unknown = only.filter((n) => !backup.tables[n]);
  if (unknown.length) {
    console.error(`Not in this backup: ${unknown.join(", ")}`);
    process.exit(1);
  }
}

const apply = flag("apply");
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`\nBackup:  ${file}`);
console.log(`Taken:   ${backup.exportedAt}${backup.exportedBy ? ` by ${backup.exportedBy}` : ""}`);
console.log(`Target:  ${url}`);
console.log(`Mode:    ${apply ? "APPLY (will write)" : "DRY RUN (will not write)"}\n`);

// ---- what is there now -----------------------------------------------------
const present = {};
for (const name of names) {
  const { count, error } = await supabase.from(name).select("*", { count: "exact", head: true });
  if (error) {
    console.error(`Cannot read table "${name}" in the target: ${error.message}`);
    console.error("Run the migrations in supabase/migrations/ first, so the tables exist.");
    process.exit(1);
  }
  present[name] = count ?? 0;
}

const width = Math.max(...names.map((n) => n.length));
console.log(`${"table".padEnd(width)}  in backup   in target now`);
for (const name of names) {
  console.log(`${name.padEnd(width)}  ${String(backup.tables[name].rows.length).padStart(9)}   ${String(present[name]).padStart(13)}`);
}
console.log();

const nonEmpty = names.filter((n) => present[n] > 0);
if (nonEmpty.length && !flag("allow-nonempty")) {
  console.log(`The target already has data in: ${nonEmpty.join(", ")}.`);
  console.log("Restoring replaces matching rows with the backup's (older) versions.");
  console.log("Use a new, empty project — or pass --allow-nonempty if you are sure.\n");
  if (apply) process.exit(1);
}

if (!apply) {
  console.log("Dry run only — nothing was written. Add --apply to restore.\n");
  process.exit(0);
}

// ---- restore ----------------------------------------------------------------
const CHUNK = 200;
const chunks = (rows) => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

for (const name of names) {
  const t = backup.tables[name];
  if (t.rows.length === 0) continue;
  const onConflict = t.pk.join(",");
  const hasOmitted = t.omit?.length > 0;

  for (const part of chunks(t.rows)) {
    if (hasOmitted) {
      // Step A: create rows that are missing, with an unusable placeholder for the
      // columns the backup left out. `ignoreDuplicates` means an existing row (and
      // its real password hash) is left exactly as it is.
      const withDefaults = part.map((row) => ({ ...row, ...t.restoreDefaults }));
      const a = await supabase.from(name).upsert(withDefaults, { onConflict, ignoreDuplicates: true });
      if (a.error) fail(name, a.error);
    }
    if (hasOmitted) {
      // Step B: bring every backed-up column to its backed-up value. These rows are
      // UPDATED one by one, not upserted: Postgres checks a NOT NULL column (the
      // omitted password hash) on the proposed row *before* it looks for the existing
      // one, so an upsert that leaves it out fails even for rows that exist. A plain
      // UPDATE only touches the columns it names — which never include the hash.
      for (const row of part) {
        const match = Object.fromEntries(t.pk.map((c) => [c, row[c]]));
        const changes = Object.fromEntries(Object.entries(row).filter(([c]) => !t.pk.includes(c)));
        const b = await supabase.from(name).update(changes).match(match);
        if (b.error) fail(name, b.error);
      }
    } else {
      const b = await supabase.from(name).upsert(part, { onConflict });
      if (b.error) fail(name, b.error);
    }
  }
  console.log(`restored ${name}: ${t.rows.length} rows`);
}

// ---- verify ------------------------------------------------------------------
console.log("\nVerifying row counts...");
let ok = true;
for (const name of names) {
  const { count } = await supabase.from(name).select("*", { count: "exact", head: true });
  const expected = backup.tables[name].rows.length;
  // With --allow-nonempty the target may legitimately hold more than the backup.
  const good = flag("allow-nonempty") ? (count ?? 0) >= expected : count === expected;
  if (!good) ok = false;
  console.log(`${good ? "ok  " : "FAIL"} ${name}: ${count} (backup has ${expected})`);
}

console.log(
  ok
    ? "\nRestore complete.\n- Everyone with a password must use \"forgot password\" to sign in.\n- Re-upload dish photos/videos from your originals (only their records were restored).\n"
    : "\nRestore finished but some counts differ — check the lines marked FAIL above.\n"
);
process.exit(ok ? 0 : 1);

function fail(table, error) {
  console.error(`\nFailed on "${table}": ${error.message}`);
  console.error("Stopped. Rows already written stay written; fix the cause and run again (it is safe to repeat).\n");
  process.exit(1);
}
