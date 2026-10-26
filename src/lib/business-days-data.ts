import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { openDayFor, type ClosedDay, type DaySummary, type OpenDay } from "@/lib/business-day";

/**
 * Reading and writing `business_days` (migration 0027). Every read **degrades, never throws,
 * when the table isn't there**: reports then fall back to calendar days and the close-the-day
 * screen says it isn't set up. Only a write reports the missing table.
 */

export interface StoredBusinessDay extends ClosedDay {
  id: string;
  closedByName: string | null;
  auditNote: string | null;
  summary: Partial<DaySummary>;
}

interface Row {
  id: string;
  business_date: string;
  opened_at: string;
  closed_at: string;
  closed_by_name: string | null;
  audit_note: string | null;
  summary: Partial<DaySummary> | null;
}

function tableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|business_days/i.test(error.message ?? "")
  );
}

let warnedAt = 0;
function logMissing() {
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.warn("[business-days] run supabase/migrations/0027_business_days.sql");
}

const map = (r: Row): StoredBusinessDay => ({
  id: r.id,
  businessDate: r.business_date,
  openedAt: r.opened_at,
  closedAt: r.closed_at,
  closedByName: r.closed_by_name,
  auditNote: r.audit_note,
  summary: r.summary ?? {},
});

/** Every closed day, oldest first. One row a day, so a few thousand at most over years. */
export async function listClosedDays(): Promise<{ ready: boolean; days: StoredBusinessDay[] }> {
  const { data, error } = await supabaseAdmin()
    .from("business_days")
    .select("id, business_date, opened_at, closed_at, closed_by_name, audit_note, summary")
    .order("closed_at", { ascending: true });
  if (error) {
    if (tableMissing(error)) {
      logMissing();
      return { ready: false, days: [] };
    }
    console.error("[business-days] read failed:", error.message);
    return { ready: false, days: [] };
  }
  return { ready: true, days: (data as Row[]).map(map) };
}

/** What reports need: the closed days (only the three fields) and the open day. */
export async function getBusinessCalendar(now: Date = new Date()): Promise<{
  ready: boolean;
  closed: ClosedDay[];
  open: OpenDay;
}> {
  const { ready, days } = await listClosedDays();
  const closed = days.map(({ businessDate, openedAt, closedAt }) => ({ businessDate, openedAt, closedAt }));
  return { ready, closed, open: openDayFor(closed, now) };
}

export async function insertClosedDay(input: {
  businessDate: string;
  openedAt: string;
  closedAt: string;
  closedBy: string | null;
  closedByName: string | null;
  auditNote: string | null;
  summary: DaySummary;
}): Promise<{ ok: true } | { ok: false; reason: "notSetUp" | "alreadyClosed" | "failed" }> {
  const { error } = await supabaseAdmin().from("business_days").insert({
    business_date: input.businessDate,
    opened_at: input.openedAt,
    closed_at: input.closedAt,
    closed_by: input.closedBy,
    closed_by_name: input.closedByName,
    audit_done: true,
    audit_note: input.auditNote,
    summary: input.summary,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, reason: "alreadyClosed" };
    if (tableMissing(error)) return { ok: false, reason: "notSetUp" };
    console.error("[business-days] close failed:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}

/**
 * Reopen the most recently closed day (a day closed by mistake). Only ever the latest one —
 * reopening an older day would leave the days after it hanging off a closing that no longer
 * exists.
 */
export async function deleteLatestClosedDay(
  id: string
): Promise<{ ok: true; businessDate: string } | { ok: false; reason: "notLatest" | "missing" | "failed" }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("business_days")
    .select("id, business_date")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  if (!data) return { ok: false, reason: "missing" };
  if (data.id !== id) return { ok: false, reason: "notLatest" };

  const { error: delError } = await db.from("business_days").delete().eq("id", id);
  if (delError) {
    console.error("[business-days] reopen failed:", delError.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, businessDate: data.business_date as string };
}
