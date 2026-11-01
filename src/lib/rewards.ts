import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/admin/store";
import {
  clawbackPoints,
  earnedPoints,
  normalizeRewards,
  type RewardsConfig,
} from "@/lib/rewards-math";

/**
 * Kebabish Punten: the ledger, server side.
 *
 * The rules (what a basket earns, what points are worth) are in `rewards-math.ts`. This file
 * is the part that touches the database, and it follows three rules:
 *
 * - **Reading never breaks a page.** Until migration 0029 is run, or if the database hiccups,
 *   every read answers "no points" and logs one line, so checkout and the dashboard carry on.
 * - **Bookkeeping never fails an order.** Awarding, recording and taking back points happen
 *   after the order itself has moved on; an error is logged, never thrown into the customer's
 *   payment or the kitchen's button.
 * - **Nothing is paid twice.** Every automatic row has a `dedupe_key` and is inserted with
 *   "ignore duplicates", so a repeated Mollie webhook or a double click is harmless.
 */

export type LedgerKind = "earn" | "welcome" | "redeem" | "restore" | "clawback" | "adjust";

export interface LedgerRow {
  id: string;
  customerId: string;
  orderId: string | null;
  orderReference: string | null;
  kind: LedgerKind;
  points: number;
  note: string;
  createdAt: string;
}

export async function getRewardsConfig(): Promise<RewardsConfig> {
  const settings = await getPublicSettings();
  return normalizeRewards(settings.rewards);
}

/* ------------------------------------------------------------------ logging */

let lastWarn = 0;
function warn(message: string, error?: { message?: string } | null) {
  // One line a minute at most: a missing table would otherwise log on every page view.
  if (Date.now() - lastWarn < 60_000) return;
  lastWarn = Date.now();
  console.error(`[rewards] ${message}${error?.message ? `: ${error.message}` : ""}`);
}

function notSetUp(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    error.code === "PGRST202" ||
    /could not find|does not exist/i.test(error.message ?? "")
  );
}

/* ----------------------------------------------------------------- balances */

/** The ledger sum. Null when the tables aren't there yet (migration 0029). */
export async function ledgerBalance(customerId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin().rpc("reward_balance", { p_customer: customerId });
  if (error) {
    warn(notSetUp(error) ? "run migration 0029" : "could not read a balance", error);
    return null;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Points spoken for by baskets still waiting for their payment. They leave the ledger only when
 * the order is paid, so until then they are subtracted here: the same points can't pay for two
 * baskets. An abandoned or cancelled checkout stops holding them by itself.
 */
export async function heldPoints(customerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("points_redeemed")
    .eq("customer_id", customerId)
    .eq("payment_status", "open")
    .neq("status", "cancelled")
    .gt("points_redeemed", 0);
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + (r.points_redeemed as number), 0);
}

/** Points on paid orders that haven't been delivered yet: coming, not spendable. */
export async function pendingPoints(customerId: string, config: RewardsConfig): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("subtotal_cents, discount_cents")
    .eq("customer_id", customerId)
    .eq("payment_status", "paid")
    .not("status", "in", "(delivered,cancelled)");
  if (error) return 0;
  return (data ?? []).reduce(
    (sum, o) => sum + earnedPoints(o.subtotal_cents, o.discount_cents, config),
    0
  );
}

export interface CustomerRewards {
  config: RewardsConfig;
  balance: number;
  /** Spoken for by baskets awaiting payment. */
  held: number;
  /** What can be spent right now. */
  available: number;
  pending: number;
  history: LedgerRow[];
}

/** Everything the dashboard and checkout show for one customer. Null = switched off or not set up. */
export async function getCustomerRewards(
  customerId: string,
  historyLimit = 8
): Promise<CustomerRewards | null> {
  const config = await getRewardsConfig();
  if (!config.enabled) return null;
  const balance = await ledgerBalance(customerId);
  if (balance === null) return null;
  const [held, pending, history] = await Promise.all([
    heldPoints(customerId),
    pendingPoints(customerId, config),
    listLedger({ customerId, limit: historyLimit }),
  ]);
  return {
    config,
    balance,
    held,
    available: Math.max(balance - held, 0),
    pending,
    history,
  };
}

/** What checkout needs to know: how much can be spent now. Null = nothing to offer. */
export async function availablePoints(customerId: string): Promise<number | null> {
  const balance = await ledgerBalance(customerId);
  if (balance === null) return null;
  return Math.max(balance - (await heldPoints(customerId)), 0);
}

/* ------------------------------------------------------------------- writes */

interface NewRow {
  customer_id: string;
  order_id?: string | null;
  kind: LedgerKind;
  points: number;
  note: string;
  dedupe_key?: string;
  created_by?: string | null;
}

/** Insert rows, quietly skipping any whose dedupe_key already exists. */
async function insertRows(rows: NewRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const { error } = await supabaseAdmin()
    .from("reward_ledger")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) {
    warn(notSetUp(error) ? "run migration 0029" : "could not write to the ledger", error);
    return false;
  }
  return true;
}

/**
 * Pay out the points for a delivered, paid order that belongs to an account. Called whenever an
 * order becomes delivered *or* paid (a cash order is often marked paid after the ride), so it
 * checks both and does nothing until both are true. The first rewarded order also brings the
 * welcome bonus. Never throws.
 */
export async function awardOrderPoints(orderId: string): Promise<void> {
  try {
    const config = await getRewardsConfig();
    if (!config.enabled) return;

    const { data: order, error } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id, status, payment_status, subtotal_cents, discount_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order || !order.customer_id) return;
    if (order.status !== "delivered" || order.payment_status !== "paid") return;

    const points = earnedPoints(order.subtotal_cents, order.discount_cents, config);
    const rows: NewRow[] = [];
    if (points > 0) {
      rows.push({
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "earn",
        points,
        note: `Order ${order.reference}`,
        dedupe_key: `earn:${order.id}`,
      });
    }
    if (config.welcomePoints > 0) {
      rows.push({
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "welcome",
        points: config.welcomePoints,
        note: "Welcome to Kebabish Punten",
        dedupe_key: `welcome:${order.customer_id}`,
      });
    }
    await insertRows(rows);
  } catch (error) {
    console.error("[rewards] could not award points:", error);
  }
}

/**
 * The points a paid order spent at checkout leave the balance now (they were only held until
 * this moment). Called wherever an order becomes paid. Never throws.
 */
export async function recordOrderRedemption(orderId: string): Promise<void> {
  try {
    const { data: order, error } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id, points_redeemed")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order || !order.customer_id || !(order.points_redeemed > 0)) return;
    await insertRows([
      {
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "redeem",
        points: -order.points_redeemed,
        note: `Used on order ${order.reference}`,
        dedupe_key: `redeem:${order.id}`,
      },
    ]);
  } catch (error) {
    console.error("[rewards] could not record spent points:", error);
  }
}

async function orderRows(orderId: string): Promise<{ kind: LedgerKind; points: number }[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("reward_ledger")
    .select("kind, points")
    .eq("order_id", orderId);
  if (error) {
    if (!notSetUp(error)) warn("could not read an order's points", error);
    return null;
  }
  return (data ?? []) as { kind: LedgerKind; points: number }[];
}

/**
 * An order was cancelled, or refunded in full: points it spent go back, and points it earned
 * are taken back (whatever hasn't been taken already). Safe to call twice. Never throws.
 */
export async function reverseOrderRewards(orderId: string): Promise<void> {
  try {
    const rows = await orderRows(orderId);
    if (!rows || rows.length === 0) return;
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return;

    const out: NewRow[] = [];
    const spent = rows.filter((r) => r.kind === "redeem").reduce((s, r) => s + -r.points, 0);
    const restored = rows.filter((r) => r.kind === "restore").reduce((s, r) => s + r.points, 0);
    if (spent > restored) {
      out.push({
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "restore",
        points: spent - restored,
        note: `Order ${order.reference} was cancelled or refunded`,
        dedupe_key: `restore:${order.id}`,
      });
    }
    const stillEarned = rows
      .filter((r) => r.kind === "earn" || r.kind === "clawback")
      .reduce((s, r) => s + r.points, 0);
    if (stillEarned > 0) {
      out.push({
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "clawback",
        points: -stillEarned,
        note: `Order ${order.reference} was refunded`,
        dedupe_key: `reverse:${order.id}`,
      });
    }
    await insertRows(out);
  } catch (error) {
    console.error("[rewards] could not reverse an order's points:", error);
  }
}

/**
 * Part of an order was refunded: take back the same share of the points it earned. One row per
 * credit note, so a retried call can't take them twice. Never throws.
 */
export async function clawbackForRefund(
  orderId: string,
  creditNoteNumber: string,
  refundCents: number
): Promise<void> {
  try {
    const rows = await orderRows(orderId);
    if (!rows) return;
    const earned = rows.filter((r) => r.kind === "earn").reduce((s, r) => s + r.points, 0);
    if (earned <= 0) return;
    const stillEarned = rows
      .filter((r) => r.kind === "earn" || r.kind === "clawback")
      .reduce((s, r) => s + r.points, 0);

    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id, total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return;

    const take = clawbackPoints(earned, stillEarned, refundCents, order.total_cents);
    if (take <= 0) return;
    await insertRows([
      {
        customer_id: order.customer_id,
        order_id: order.id,
        kind: "clawback",
        points: -take,
        note: `Refund on order ${order.reference}`,
        dedupe_key: `clawback:${order.id}:${creditNoteNumber}`,
      },
    ]);
  } catch (error) {
    console.error("[rewards] could not take points back for a refund:", error);
  }
}

export type AdjustResult = { ok: true; balance: number } | { ok: false; message: string };

/** Staff add or remove points by hand. A reason is required and the balance can't go below zero. */
export async function adjustPoints(input: {
  customerId: string;
  points: number;
  note: string;
  adminId: string;
}): Promise<AdjustResult> {
  const note = input.note.trim().slice(0, 200);
  if (!Number.isInteger(input.points) || input.points === 0 || Math.abs(input.points) > 1_000_000) {
    return { ok: false, message: "Enter a whole number of points, other than 0." };
  }
  if (note.length < 3) return { ok: false, message: "Give a short reason." };

  const balance = await ledgerBalance(input.customerId);
  if (balance === null) {
    return { ok: false, message: "Rewards aren't set up yet (run migration 0029)." };
  }
  if (balance + input.points < 0) {
    return { ok: false, message: `They only have ${balance.toLocaleString("en-GB")} points.` };
  }
  const ok = await insertRows([
    {
      customer_id: input.customerId,
      kind: "adjust",
      points: input.points,
      note,
      created_by: input.adminId,
    },
  ]);
  if (!ok) return { ok: false, message: "Couldn't save that. Try again." };
  return { ok: true, balance: balance + input.points };
}

/* -------------------------------------------------------------------- reads */

export async function listLedger(options: {
  customerId?: string;
  limit?: number;
}): Promise<LedgerRow[]> {
  let query = supabaseAdmin()
    .from("reward_ledger")
    .select("id, customer_id, order_id, kind, points, note, created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.customerId) query = query.eq("customer_id", options.customerId);
  const { data, error } = await query;
  if (error) {
    if (!notSetUp(error)) warn("could not read the ledger", error);
    return [];
  }

  const orderIds = [...new Set((data ?? []).map((r) => r.order_id).filter(Boolean))] as string[];
  const references = new Map<string, string>();
  if (orderIds.length > 0) {
    const { data: orders } = await supabaseAdmin().from("orders").select("id, reference").in("id", orderIds);
    for (const o of orders ?? []) references.set(o.id, o.reference);
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    orderId: r.order_id,
    orderReference: r.order_id ? (references.get(r.order_id) ?? null) : null,
    kind: r.kind as LedgerKind,
    points: r.points,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export interface RewardsOverview {
  /** False until migration 0029 is run. */
  ready: boolean;
  byKind: Record<LedgerKind, number>;
  outstanding: number;
}

export async function rewardsOverview(): Promise<RewardsOverview> {
  const byKind: Record<LedgerKind, number> = {
    earn: 0,
    welcome: 0,
    redeem: 0,
    restore: 0,
    clawback: 0,
    adjust: 0,
  };
  const { data, error } = await supabaseAdmin().rpc("reward_totals");
  if (error) return { ready: false, byKind, outstanding: 0 };
  for (const row of (data ?? []) as { kind: LedgerKind; total: number }[]) {
    if (row.kind in byKind) byKind[row.kind] = Number(row.total);
  }
  const outstanding = Object.values(byKind).reduce((a, b) => a + b, 0);
  return { ready: true, byKind, outstanding };
}

export interface CustomerHit {
  id: string;
  name: string;
  email: string;
  balance: number;
}

/** Look a registered customer up by email address, for adjusting their points. */
export async function findCustomerByEmail(email: string): Promise<CustomerHit | null> {
  const { data } = await supabaseAdmin()
    .from("customers")
    .select("id, name, email")
    .ilike("email", email.trim())
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, balance: (await ledgerBalance(data.id)) ?? 0 };
}

/** Names and emails for the ledger table in the admin. */
export async function customerNames(ids: string[]): Promise<Map<string, { name: string; email: string }>> {
  const map = new Map<string, { name: string; email: string }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const { data } = await supabaseAdmin().from("customers").select("id, name, email").in("id", unique);
  for (const c of data ?? []) map.set(c.id, { name: c.name, email: c.email });
  return map;
}
