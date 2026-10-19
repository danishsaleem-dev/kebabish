import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { stockLevel, type StockEntry } from "@/lib/stock-status";
import { sendStockAlertEmail, type StockAlert } from "@/lib/email/stock-alert";

/**
 * Stock / batch quantities for dishes (migration 0022).
 *
 * A dish *tracks* stock when it has a row in `item_stock`; no row = it behaves as it always did.
 * What the rest of the app relies on:
 *  - `readStockMap()` — the quantities, or `null` when the migration hasn't been run (every caller
 *    treats that as "no dish tracks stock", so nothing breaks before it is).
 *  - **At zero a dish is sold out**, derived from the quantity — it is not a flag anyone has to set,
 *    and it comes back by itself when the owner adds a batch. It stays on the menu: sold out is what
 *    turns on the "request this dish" form.
 *  - Stock is **taken when an order is committed** — paid online, or accepted by staff (a phone
 *    order) — and **given back if it is cancelled**. Both moves are single SQL functions reading the
 *    order's own lines, and each is idempotent (`order_stock_holds`), so a repeated Mollie webhook or
 *    a double cancel can't take or return the same portions twice.
 *  - When a move takes a dish down across its warning level, or to nothing, the owner is emailed once.
 */

export type StockMap = Map<string, StockEntry>;

interface StockRow {
  item_slug: string;
  quantity: number;
  low_threshold: number;
}

/** True for "table/function isn't there yet" — migration 0022 not run. */
function isMissing(error: { code?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202"));
}

let warnedAt = 0;
function warnMissing() {
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.error("[stock] stock tracking isn't set up - run supabase/migrations/0022_stock.sql.");
}

/** Every dish that tracks stock, or null if the migration hasn't been run. Never throws. */
export async function readStockMap(): Promise<StockMap | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("item_stock")
      .select("item_slug, quantity, low_threshold");
    if (error) {
      if (isMissing(error)) warnMissing();
      else console.error("[stock] couldn't read stock:", error.message);
      return null;
    }
    return new Map(
      ((data ?? []) as StockRow[]).map((r) => [r.item_slug, { quantity: r.quantity, lowThreshold: r.low_threshold }])
    );
  } catch (error) {
    console.error("[stock] couldn't read stock:", error);
    return null;
  }
}

/** Whether the stock tables exist (the dish editor says so when they don't). */
export async function stockIsSetUp(): Promise<boolean> {
  const { error } = await supabaseAdmin().from("item_stock").select("item_slug").limit(1);
  return !error;
}

/** Start, change or stop tracking a dish. `null` stops tracking (the row is removed). */
export async function setItemStock(slug: string, entry: StockEntry | null): Promise<void> {
  const db = supabaseAdmin();
  if (!entry) {
    const { error } = await db.from("item_stock").delete().eq("item_slug", slug);
    if (error && !isMissing(error)) throw new Error(error.message);
    return;
  }
  const quantity = Math.min(Math.max(Math.trunc(entry.quantity), 0), 100_000);
  const lowThreshold = Math.min(Math.max(Math.trunc(entry.lowThreshold), 0), 100_000);
  const { error } = await db.from("item_stock").upsert(
    { item_slug: slug, quantity, low_threshold: lowThreshold, updated_at: new Date().toISOString() },
    { onConflict: "item_slug" }
  );
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------- what needs the owner's eye */

export interface StockWatch {
  slug: string;
  name: string;
  level: "low" | "out";
  quantity: number;
  lowThreshold: number;
}

/**
 * Dishes that are out or running low right now, worst first — what the dashboard card and the
 * notification bell show. A dish that isn't on the menu any more (hidden or deleted) is left out.
 */
export async function listStockAlerts(): Promise<StockWatch[]> {
  const stock = await readStockMap();
  if (!stock || stock.size === 0) return [];
  const store = await readStore();
  const result: StockWatch[] = [];
  for (const item of store.items) {
    const entry = stock.get(item.slug);
    const level = stockLevel(entry);
    if (!entry || !item.visible || (level !== "low" && level !== "out")) continue;
    result.push({ slug: item.slug, name: item.name, level, quantity: entry.quantity, lowThreshold: entry.lowThreshold });
  }
  return result.sort((a, b) => Number(b.level === "out") - Number(a.level === "out") || a.quantity - b.quantity);
}

/* ------------------------------------------------------------------ order moves */

interface MoveRow {
  out_slug: string;
  out_before: number;
  out_after: number;
  out_threshold: number;
}

/** Work out which of the changed dishes just ran low or out — once, on the crossing. */
export function crossings(rows: MoveRow[]): { slug: string; level: "low" | "out"; quantity: number }[] {
  const result: { slug: string; level: "low" | "out"; quantity: number }[] = [];
  for (const r of rows) {
    const before = stockLevel({ quantity: r.out_before, lowThreshold: r.out_threshold });
    const after = stockLevel({ quantity: r.out_after, lowThreshold: r.out_threshold });
    if (after === "out" && before !== "out") result.push({ slug: r.out_slug, level: "out", quantity: r.out_after });
    else if (after === "low" && before === "ok") result.push({ slug: r.out_slug, level: "low", quantity: r.out_after });
  }
  return result;
}

async function runMove(fn: "consume_order_stock" | "resync_order_stock", orderId: string): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin().rpc(fn, { p_order: orderId });
    if (error) {
      if (!isMissing(error)) console.error(`[stock] ${fn} failed for order ${orderId}:`, error.message);
      return;
    }
    const alerts = crossings((data ?? []) as MoveRow[]);
    if (alerts.length > 0) await notify(alerts);
  } catch (error) {
    // Stock bookkeeping must never fail an order that has already been paid or accepted.
    console.error(`[stock] ${fn} failed for order ${orderId}:`, error);
  }
}

/** Take this order's dishes out of stock (once). Call when it is paid, or accepted by staff. */
export const consumeOrderStock = (orderId: string) => runMove("consume_order_stock", orderId);

/** The order was edited after it took its stock: return the old lines, take the new ones. */
export const resyncOrderStock = (orderId: string) => runMove("resync_order_stock", orderId);

/** The order was cancelled: give its portions back. Safe to call twice. */
export async function releaseOrderStock(orderId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin().rpc("release_order_stock", { p_order: orderId });
    if (error && !isMissing(error)) console.error(`[stock] release failed for order ${orderId}:`, error.message);
  } catch (error) {
    console.error(`[stock] release failed for order ${orderId}:`, error);
  }
}

/* ---------------------------------------------------------------- the owner's alert */

async function notify(alerts: { slug: string; level: "low" | "out"; quantity: number }[]): Promise<void> {
  // The dish names live in the menu document; look them up here so the email says "Chicken Biryani".
  let names = new Map<string, string>();
  try {
    const store = await readStore();
    names = new Map(store.items.map((i) => [i.slug, i.name]));
  } catch {
    // The slug is readable enough.
  }
  const payload: StockAlert[] = alerts.map((a) => ({ ...a, name: names.get(a.slug) ?? a.slug }));
  const send = () => sendStockAlertEmail(payload);
  try {
    after(send);
  } catch {
    // Not inside a request (a script): send straight away.
    await send();
  }
}
