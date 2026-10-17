import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Reads and writes the `stock_requests` table (migration 0021): a customer who
 * finds a dish sold out asks for it — how many, and for when.
 *
 * Like feedback, every read **degrades, not throws, when the table doesn't exist
 * yet** (the migration is run by hand and ships alongside the code): the admin
 * screen then says it isn't set up, and the public form says it couldn't save.
 */

export type StockRequestStatus = "new" | "contacted" | "done" | "declined";

export interface StockRequest {
  id: string;
  createdAt: string;
  itemSlug: string;
  itemName: string;
  quantity: number;
  wantedDate: string | null;
  wantedTime: string | null;
  customerName: string;
  phone: string;
  email: string;
  note: string;
  locale: string;
  status: StockRequestStatus;
  handledAt: string | null;
}

interface Row {
  id: string;
  created_at: string;
  item_slug: string;
  item_name: string;
  quantity: number;
  wanted_date: string | null;
  wanted_time: string | null;
  customer_name: string;
  phone: string;
  email: string;
  note: string;
  locale: string;
  status: StockRequestStatus;
  handled_at: string | null;
}

const COLUMNS =
  "id, created_at, item_slug, item_name, quantity, wanted_date, wanted_time, customer_name, phone, email, note, locale, status, handled_at";

function map(row: Row): StockRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    itemSlug: row.item_slug,
    itemName: row.item_name,
    quantity: row.quantity,
    wantedDate: row.wanted_date,
    wantedTime: row.wanted_time,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    locale: row.locale,
    status: row.status,
    handledAt: row.handled_at,
  };
}

/** Postgres "undefined table" (and PostgREST's "not in schema cache"). */
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");

export interface NewStockRequest {
  itemSlug: string;
  itemName: string;
  quantity: number;
  wantedDate: string | null;
  wantedTime: string | null;
  customerName: string;
  phone: string;
  email: string;
  note: string;
  locale: string;
}

/** Saves a request. `false` means it was NOT saved (the log says why). */
export async function insertStockRequest(input: NewStockRequest): Promise<boolean> {
  const { error } = await supabaseAdmin().from("stock_requests").insert({
    item_slug: input.itemSlug,
    item_name: input.itemName,
    quantity: input.quantity,
    wanted_date: input.wantedDate,
    wanted_time: input.wantedTime,
    customer_name: input.customerName,
    phone: input.phone,
    email: input.email,
    note: input.note,
    locale: input.locale === "en" ? "en" : "nl",
  });
  if (error) {
    console.error(
      isMissingTable(error)
        ? "[stock-requests] table missing - run migration 0021."
        : `[stock-requests] couldn't save a request: ${error.message}`
    );
    return false;
  }
  return true;
}

/** Newest first. `ready: false` = the table isn't there yet. */
export async function listStockRequests(): Promise<{ ready: boolean; items: StockRequest[] }> {
  const { data, error } = await supabaseAdmin()
    .from("stock_requests")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (!isMissingTable(error)) console.error("[stock-requests] couldn't read requests:", error.message);
    return { ready: false, items: [] };
  }
  return { ready: true, items: (data ?? []).map((r) => map(r as Row)) };
}

export async function setStockRequestStatus(
  id: string,
  status: StockRequestStatus,
  by: string | null
): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("stock_requests")
    .update({
      status,
      handled_at: status === "new" ? null : new Date().toISOString(),
      handled_by: status === "new" ? null : by,
    })
    .eq("id", id);
  if (error) console.error("[stock-requests] couldn't update a request:", error.message);
  return !error;
}

export async function deleteStockRequest(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("stock_requests").delete().eq("id", id);
  if (error) console.error("[stock-requests] couldn't delete a request:", error.message);
  return !error;
}
