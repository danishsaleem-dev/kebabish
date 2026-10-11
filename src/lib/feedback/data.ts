import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FeedbackSource } from "@/lib/feedback/questions";

/**
 * Reads and writes the `feedback` table (migration 0018).
 *
 * Every function here is written to **degrade, not throw, when the table
 * doesn't exist yet**: the migration is run by hand, and the code that links to
 * feedback (customer dashboard, the order page, the admin screen) ships
 * alongside it. A missing table must mean "no feedback to show", never a 500 on
 * a customer's own order page. Only `insertFeedback` reports the problem, so
 * the form can say it couldn't save and the log says why.
 */

export interface StoredFeedback {
  id: string;
  createdAt: string;
  orderId: string | null;
  orderReference: string | null;
  customerId: string | null;
  source: FeedbackSource | string;
  locale: string;
  orderedBefore: string | null;
  answers: Record<string, number>;
  recommend: number | null;
  dishes: { slug: string; name: string }[];
  favouriteSlug: string | null;
  heardFrom: string | null;
  comment: string | null;
  quoteOk: boolean;
  contactOk: boolean;
  contactName: string | null;
  contactEmail: string | null;
  handledAt: string | null;
}

interface FeedbackRow {
  id: string;
  created_at: string;
  order_id: string | null;
  order_reference: string | null;
  customer_id: string | null;
  source: string;
  locale: string;
  ordered_before: string | null;
  answers: Record<string, number> | null;
  recommend: number | null;
  dishes: { slug: string; name: string }[] | null;
  favourite_slug: string | null;
  heard_from: string | null;
  comment: string | null;
  quote_ok: boolean;
  contact_ok: boolean;
  contact_name: string | null;
  contact_email: string | null;
  handled_at: string | null;
}

function map(row: FeedbackRow): StoredFeedback {
  return {
    id: row.id,
    createdAt: row.created_at,
    orderId: row.order_id,
    orderReference: row.order_reference,
    customerId: row.customer_id,
    source: row.source,
    locale: row.locale,
    orderedBefore: row.ordered_before,
    answers: row.answers ?? {},
    recommend: row.recommend,
    dishes: row.dishes ?? [],
    favouriteSlug: row.favourite_slug,
    heardFrom: row.heard_from,
    comment: row.comment,
    quoteOk: row.quote_ok,
    contactOk: row.contact_ok,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    handledAt: row.handled_at,
  };
}

/** PostgREST / Postgres codes for "that table isn't there". */
function tableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

export interface NewFeedback {
  orderId: string | null;
  orderReference: string | null;
  customerId: string | null;
  source: string;
  locale: string;
  orderedBefore: string | null;
  answers: Record<string, number>;
  recommend: number | null;
  dishes: { slug: string; name: string }[];
  favouriteSlug: string | null;
  heardFrom: string | null;
  comment: string | null;
  quoteOk: boolean;
  contactOk: boolean;
  contactName: string | null;
  contactEmail: string | null;
}

export type InsertResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate" | "not_ready" | "failed" };

export async function insertFeedback(input: NewFeedback): Promise<InsertResult> {
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .insert({
      order_id: input.orderId,
      order_reference: input.orderReference,
      customer_id: input.customerId,
      source: input.source,
      locale: input.locale,
      ordered_before: input.orderedBefore,
      answers: input.answers,
      recommend: input.recommend,
      dishes: input.dishes,
      favourite_slug: input.favouriteSlug,
      heard_from: input.heardFrom,
      comment: input.comment,
      quote_ok: input.quoteOk,
      contact_ok: input.contactOk,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
    })
    .select("id")
    .single();

  if (error) {
    // The unique index on order_id: this order already has its feedback.
    if (error.code === "23505") return { ok: false, reason: "duplicate" };
    if (tableMissing(error)) {
      console.error("[feedback] the feedback table is missing — run migration 0018:", error.message);
      return { ok: false, reason: "not_ready" };
    }
    console.error("[feedback] could not save feedback:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, id: data.id as string };
}

/** Has this order already been given feedback? False if the table isn't there. */
export async function orderHasFeedback(orderId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (error) {
    if (!tableMissing(error)) console.error("[feedback] lookup failed:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Which of these orders already have feedback — for marking them on the dashboard. */
export async function orderIdsWithFeedback(orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("order_id")
    .in("order_id", orderIds);
  if (error) {
    if (!tableMissing(error)) console.error("[feedback] lookup failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.order_id as string));
}

/** Newest first. `ready` is false when the table doesn't exist, so the admin can say so. */
export async function listFeedback(
  limit = 1000
): Promise<{ ready: boolean; items: StoredFeedback[] }> {
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (tableMissing(error)) return { ready: false, items: [] };
    throw new Error(error.message);
  }
  return { ready: true, items: (data as FeedbackRow[]).map(map) };
}

export async function getFeedbackForOrder(orderId: string): Promise<StoredFeedback | null> {
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    if (!tableMissing(error)) console.error("[feedback] lookup failed:", error.message);
    return null;
  }
  return data ? map(data as FeedbackRow) : null;
}

/** Toggle "handled". Returns the new state, or null if the row isn't there. */
export async function toggleHandled(id: string): Promise<boolean | null> {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("feedback").select("handled_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const next = row.handled_at ? null : new Date().toISOString();
  const { error: updateError } = await db.from("feedback").update({ handled_at: next }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  return next !== null;
}
