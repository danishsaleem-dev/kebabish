import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Persistence for editable website content (migration 0019).
 *
 * The one rule that shapes everything here: **reading must never fail a page.**
 * Every public page — checkout included — renders through `getContent()`, so a
 * missing table, a Supabase outage or a malformed row has to cost the owner his
 * edits for a while, not cost a customer the website. Reads therefore swallow
 * errors, log them (at most once a minute), and hand back "no overrides", which
 * is exactly the site as it ships.
 *
 * Writes are the opposite: they throw, so the admin sees why a save failed.
 */

export type ContentLocale = "nl" | "en";
export type AnyLocale = ContentLocale | "*";

export interface ContentSnapshot {
  /** Text overrides by language, keyed by message path. */
  text: Record<ContentLocale, Record<string, unknown>>;
  /** Language-independent values (layout, media slots, the reviews list). */
  shared: Record<string, unknown>;
  /** False when the read failed and this is the empty fallback. */
  loaded: boolean;
}

export interface OverrideRow {
  key: string;
  locale: AnyLocale;
  value: unknown;
  updatedAt: string;
  updatedBy: string | null;
}

export interface HistoryRow {
  id: number;
  value: unknown;
  changedAt: string;
  changedBy: string | null;
}

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

/** Thrown by writes (and by the admin's own reads) when migration 0019 hasn't been run. */
export class ContentSetupError extends Error {
  constructor() {
    super(
      "The content tables don't exist yet. Run supabase/migrations/0019_site_content.sql in the Supabase SQL editor."
    );
  }
}

function empty(loaded: boolean): ContentSnapshot {
  return { text: { nl: {}, en: {} }, shared: {}, loaded };
}

// ---------------------------------------------------------------------------
// The cached read the public site uses
// ---------------------------------------------------------------------------

/**
 * How long a snapshot is trusted. Pages are statically generated and revalidated
 * (60 s on the site layout, plus an immediate revalidatePath when the owner
 * saves), so this only matters for pages that render per request — and for the
 * moment between a save and another server instance noticing it. Short enough
 * that nobody waits for an edit; long enough that a busy minute is one query
 * rather than one per visitor.
 */
const TTL_MS = 15_000;
const FAILURE_TTL_MS = 10_000;

let cached: { at: number; ttl: number; snapshot: ContentSnapshot } | null = null;
let inflight: Promise<ContentSnapshot> | null = null;
let lastLogged = 0;

function logFailure(message: string) {
  const now = Date.now();
  if (now - lastLogged < 60_000) return;
  lastLogged = now;
  console.error(`[content] couldn't load editable content, showing the built-in text: ${message}`);
}

export function toSnapshot(rows: OverrideRow[]): ContentSnapshot {
  const snapshot = empty(true);
  for (const row of rows) {
    if (row.locale === "*") snapshot.shared[row.key] = row.value;
    else snapshot.text[row.locale][row.key] = row.value;
  }
  return snapshot;
}

async function readSnapshot(): Promise<ContentSnapshot> {
  try {
    const rows = await listOverrides();
    return toSnapshot(rows);
  } catch (error) {
    logFailure(error instanceof ContentSetupError ? "run migration 0019" : (error as Error).message);
    return empty(false);
  }
}

/** Everything the owner has changed, as the site uses it. Never throws. */
export async function getContent(): Promise<ContentSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < cached.ttl) return cached.snapshot;
  // Concurrent renders share one query instead of each firing their own.
  inflight ??= readSnapshot().finally(() => {
    inflight = null;
  });
  const snapshot = await inflight;
  cached = { at: Date.now(), ttl: snapshot.loaded ? TTL_MS : FAILURE_TTL_MS, snapshot };
  return snapshot;
}

/** Forget what was cached, so the next read sees a save at once (this instance only). */
export function invalidateContent(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Admin reads (uncached; they throw so a missing table is visible)
// ---------------------------------------------------------------------------

export async function listOverrides(): Promise<OverrideRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("site_content")
    .select("key, locale, value, updated_at, updated_by");
  if (error) {
    if (MISSING_TABLE.has(error.code)) throw new ContentSetupError();
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    key: r.key as string,
    locale: r.locale as AnyLocale,
    value: r.value,
    updatedAt: r.updated_at as string,
    updatedBy: (r.updated_by as string | null) ?? null,
  }));
}

export async function readHistory(key: string, locale: AnyLocale, limit = 12): Promise<HistoryRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("site_content_history")
    .select("id, value, changed_at, changed_by")
    .eq("key", key)
    .eq("locale", locale)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    if (MISSING_TABLE.has(error.code)) throw new ContentSetupError();
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: r.id as number,
    value: r.value,
    changedAt: r.changed_at as string,
    changedBy: (r.changed_by as string | null) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface ContentChange {
  key: string;
  locale: AnyLocale;
  /** The new value, or null to go back to the default (deletes the row). */
  value: unknown | null;
}

/** How many history entries to keep per field. Older ones are pruned on write. */
const HISTORY_KEEP = 25;

/**
 * Apply a batch of changes and record each in the history. Not one transaction
 * (PostgREST has none), but ordered so that a failure part-way leaves the live
 * content correct and at worst a missing history line.
 */
export async function saveChanges(
  changes: ContentChange[],
  actor: string,
  options: { history?: boolean } = {}
): Promise<void> {
  if (changes.length === 0) return;
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const upserts = changes.filter((c) => c.value !== null);
  const resets = changes.filter((c) => c.value === null);

  if (upserts.length) {
    const { error } = await db.from("site_content").upsert(
      upserts.map((c) => ({
        key: c.key,
        locale: c.locale,
        value: c.value,
        updated_at: now,
        updated_by: actor,
      })),
      { onConflict: "key,locale" }
    );
    if (error) {
      if (MISSING_TABLE.has(error.code)) throw new ContentSetupError();
      throw new Error(error.message);
    }
  }

  for (const c of resets) {
    const { error } = await db.from("site_content").delete().eq("key", c.key).eq("locale", c.locale);
    if (error) {
      if (MISSING_TABLE.has(error.code)) throw new ContentSetupError();
      throw new Error(error.message);
    }
  }

  if (options.history === false) {
    invalidateContent();
    return;
  }

  const { error: historyError } = await db.from("site_content_history").insert(
    changes.map((c) => ({
      key: c.key,
      locale: c.locale,
      value: c.value,
      changed_at: now,
      changed_by: actor,
    }))
  );
  // The change itself is live; a lost history line is a nuisance, not a failure.
  if (historyError) console.error("[content] couldn't record history:", historyError.message);
  else await pruneHistory(changes);

  invalidateContent();
}

async function pruneHistory(changes: ContentChange[]): Promise<void> {
  const db = supabaseAdmin();
  for (const c of changes) {
    const { data } = await db
      .from("site_content_history")
      .select("id")
      .eq("key", c.key)
      .eq("locale", c.locale)
      .order("id", { ascending: false })
      .range(HISTORY_KEEP, HISTORY_KEEP + 200);
    const stale = (data ?? []).map((r) => r.id as number);
    if (stale.length) await db.from("site_content_history").delete().in("id", stale);
  }
}
