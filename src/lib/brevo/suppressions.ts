import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/brevo/audience";

/**
 * Our mirror of Brevo's suppression list (`marketing_suppressions`, migration
 * 0032).
 *
 * Brevo is the authority on who has unsubscribed — but the audience filter has
 * to be answerable from our own database. Two reasons: a guest has no
 * `customers` row to flag, and asking Brevo on every admin page load would eat
 * a rate limit that allows 100 campaign reads an hour.
 *
 * Every read here **degrades rather than throws** when the migration hasn't
 * been run, like `feedback/data.ts` and `stock.ts` do — except that a read
 * failure is *not* treated as "nobody is suppressed". `readSuppressed()`
 * returns null on failure and every caller that would send email treats null
 * as "I don't know, so don't send". Failing open here would email people who
 * had unsubscribed, which is the one mistake in this feature that cannot be
 * taken back.
 */

export type SuppressionReason =
  | "unsubscribe"
  | "hard_bounce"
  | "soft_bounce"
  | "spam"
  | "manual"
  | "contact_deleted";

export interface Suppression {
  email: string;
  reason: SuppressionReason;
  at: string;
  campaign: string | null;
}

interface SuppressionRow {
  email: string;
  reason: string;
  at: string;
  campaign: string | null;
}

function tableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

let warnedAt = 0;

function warnMigration(what: string): void {
  const now = Date.now();
  if (now - warnedAt < 60_000) return;
  warnedAt = now;
  console.warn(`[brevo] ${what} — run supabase/migrations/0032_marketing_contacts.sql`);
}

/**
 * Every suppressed address, lowercased.
 *
 * **null means "could not be read"**, which is different from an empty set.
 * Callers about to send must refuse on null; callers only displaying a count
 * may show it as unknown.
 */
export async function readSuppressed(): Promise<Set<string> | null> {
  const { data, error } = await supabaseAdmin()
    .from("marketing_suppressions")
    .select("email");

  if (error) {
    if (tableMissing(error)) warnMigration("the marketing suppression list isn't set up");
    else console.error("[brevo] could not read suppressions:", error.message);
    return null;
  }

  return new Set((data ?? []).map((row) => normalizeEmail((row as { email: string }).email)));
}

/** The full list for the admin screen, newest first. Empty on any failure. */
export async function listSuppressions(limit = 200): Promise<Suppression[]> {
  const { data, error } = await supabaseAdmin()
    .from("marketing_suppressions")
    .select("email, reason, at, campaign")
    .order("at", { ascending: false })
    .limit(limit);

  if (error) {
    if (tableMissing(error)) warnMigration("the marketing suppression list isn't set up");
    else console.error("[brevo] could not list suppressions:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as SuppressionRow;
    return {
      email: r.email,
      reason: r.reason as SuppressionReason,
      at: r.at,
      campaign: r.campaign,
    };
  });
}

/**
 * Record that we must stop emailing an address.
 *
 * Idempotent on the email (it is the primary key). An existing row is left
 * alone rather than overwritten: the first reason and date are the ones worth
 * keeping, and re-recording a second bounce should not move the date of the
 * original unsubscribe.
 *
 * Returns false if it could not be written, so a webhook can answer non-2xx
 * and have Brevo retry rather than silently losing an unsubscribe.
 */
export async function suppress(
  email: string,
  reason: SuppressionReason,
  campaign?: string | null
): Promise<boolean> {
  const address = normalizeEmail(email);
  if (!address) return true;

  const { error } = await supabaseAdmin()
    .from("marketing_suppressions")
    .upsert(
      { email: address, reason, campaign: campaign ?? null },
      { onConflict: "email", ignoreDuplicates: true }
    );

  if (error) {
    if (tableMissing(error)) warnMigration("the marketing suppression list isn't set up");
    else console.error("[brevo] could not record a suppression:", error.message);
    return false;
  }

  return true;
}

/**
 * How many addresses are suppressed, for the dashboard. **null if unreadable**,
 * so the tile can show "—" rather than claiming nobody has unsubscribed.
 *
 * Deliberately not a `head: true` count query. A count with `head: true`
 * **silently swallows a missing-table error** in supabase-js — it comes back
 * with no error and a null count, which this function would then report as a
 * confident 0. That is the same trap `countAdminUsers()` documents, and it
 * showed up here on the first real run against the database: before migration
 * 0032 the dashboard said "Unsubscribed: 0" instead of "—". Counting the rows
 * we actually read cannot lie that way.
 */
export async function countSuppressions(): Promise<number | null> {
  const suppressed = await readSuppressed();
  return suppressed === null ? null : suppressed.size;
}

/* ------------------------------------------------------------ event log */

/**
 * Write a webhook event, and say whether it was new.
 *
 * `false` means the unique index rejected it — Brevo retried a delivery we
 * already handled — so the caller can answer 200 and do nothing further.
 * Brevo sends no event id for email events, hence the composite key in 0032.
 *
 * Throws only when the table is missing, which the webhook turns into a 500
 * so Brevo keeps the event and retries after the migration is run.
 */
export async function recordEvent(input: {
  event: string;
  email: string;
  campaignId: number | null;
  campaignName: string | null;
  eventAt: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin().from("marketing_events").insert({
    event: input.event,
    email: normalizeEmail(input.email),
    campaign_id: input.campaignId,
    campaign_name: input.campaignName,
    event_at: input.eventAt,
  });

  if (!error) return true;

  // 23505 = unique violation: the same event already arrived.
  if (error.code === "23505") return false;

  if (tableMissing(error)) {
    warnMigration("the marketing event log isn't set up");
    throw new Error("marketing_events is missing — run migration 0032");
  }

  throw new Error(error.message);
}
