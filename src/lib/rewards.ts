import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/admin/store";
import { amsterdamNow } from "@/lib/delivery-slots";
import { sendRewardsEmail } from "@/lib/email/rewards";
import {
  clawbackPoints,
  earnedPoints,
  normalizeRewards,
  type RewardsConfig,
} from "@/lib/rewards-math";
import {
  adjustmentEmail,
  confirmationNote,
  deliveredNote,
  referralRewardEmail,
  reversalNote,
} from "@/lib/rewards-copy";

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

export type LedgerKind =
  | "earn"
  | "welcome"
  | "redeem"
  | "restore"
  | "clawback"
  | "adjust"
  | "referral";

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
    if (error || !order) return;
    if (order.status !== "delivered" || order.payment_status !== "paid") return;

    // A friend's first order pays the customer who invited them, whether or not the friend
    // has an account of their own.
    await rewardReferral(order.id, config);

    if (!order.customer_id) return;
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

/** The language of a customer's latest order: accounts don't store one. */
async function customerLocale(customerId: string): Promise<"nl" | "en"> {
  const { data } = await supabaseAdmin()
    .from("orders")
    .select("locale")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.locale === "en" ? "en" : "nl";
}

/**
 * Pay the customer who invited this order's buyer, up to their monthly limit, and tell them.
 * Claiming the row by its status is the lock: only one call can move it out of "pending".
 */
async function rewardReferral(orderId: string, config: RewardsConfig): Promise<void> {
  if (!config.referralEnabled) return;
  const db = supabaseAdmin();
  const { data: referral, error } = await db
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !referral || referral.status !== "pending") return;

  // Amsterdam's month, like every other date the shop runs on.
  const monthStart = `${amsterdamNow().dateKey.slice(0, 7)}-01T00:00:00+01:00`;
  const { data: thisMonth } = await db
    .from("referrals")
    .select("id")
    .eq("referrer_id", referral.referrer_id)
    .eq("status", "rewarded")
    .gte("rewarded_at", monthStart);
  const capped = (thisMonth?.length ?? 0) >= config.referralMonthlyCap;

  const points = capped ? 0 : config.referralRewardPoints;
  const { data: claimed } = await db
    .from("referrals")
    .update({
      status: capped ? "capped" : "rewarded",
      points,
      rewarded_at: new Date().toISOString(),
    })
    .eq("id", referral.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length || capped) return;

  await insertRows([
    {
      customer_id: referral.referrer_id,
      order_id: orderId,
      kind: "referral",
      points,
      note: "A friend's first order",
      dedupe_key: `referral:${orderId}`,
    },
  ]);

  const [{ data: person }, balance, locale] = await Promise.all([
    db.from("customers").select("name, email").eq("id", referral.referrer_id).maybeSingle(),
    ledgerBalance(referral.referrer_id),
    customerLocale(referral.referrer_id),
  ]);
  if (person) {
    await sendRewardsEmail({
      to: person.email,
      name: person.name,
      locale,
      email: referralRewardEmail(points, balance ?? points, config, locale),
    });
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

interface OrderRow {
  kind: LedgerKind;
  points: number;
  customer_id: string;
}

async function orderRows(orderId: string): Promise<OrderRow[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("reward_ledger")
    .select("kind, points, customer_id")
    .eq("order_id", orderId);
  if (error) {
    if (!notSetUp(error)) warn("could not read an order's points", error);
    return null;
  }
  return (data ?? []) as OrderRow[];
}

/**
 * An order was cancelled, or refunded in full: points it spent go back, and points it earned
 * are taken back (whatever hasn't been taken already). Safe to call twice. Never throws.
 */
export async function reverseOrderRewards(orderId: string): Promise<void> {
  try {
    // The friend's order is gone, so nobody gets paid for it. The update fails quietly before
    // migration 0030, when there is no referral to cancel anyway.
    await supabaseAdmin()
      .from("referrals")
      .update({ status: "cancelled" })
      .eq("order_id", orderId)
      .in("status", ["pending", "rewarded", "capped"]);

    const rows = await orderRows(orderId);
    if (!rows || rows.length === 0) return;
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const out: NewRow[] = [];

    // Referral points were paid to someone else, so they are looked at on their own.
    const referral = rows.find((r) => r.kind === "referral");
    if (referral) {
      out.push({
        customer_id: referral.customer_id,
        order_id: order.id,
        kind: "clawback",
        points: -referral.points,
        note: "A friend's order was cancelled or refunded",
        dedupe_key: `reverse-referral:${order.id}`,
      });
    }

    if (order.customer_id) {
      const own = rows.filter((r) => r.customer_id === order.customer_id);
      const spent = own.filter((r) => r.kind === "redeem").reduce((s, r) => s + -r.points, 0);
      const restored = own.filter((r) => r.kind === "restore").reduce((s, r) => s + r.points, 0);
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
      const stillEarned = own
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
    const all = await orderRows(orderId);
    if (!all) return;
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, reference, customer_id, total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return;

    const rows = all.filter((r) => r.customer_id === order.customer_id);
    const earned = rows.filter((r) => r.kind === "earn").reduce((s, r) => s + r.points, 0);
    if (earned <= 0) return;
    const stillEarned = rows
      .filter((r) => r.kind === "earn" || r.kind === "clawback")
      .reduce((s, r) => s + r.points, 0);

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

  // Points never change without the customer hearing about it.
  const [{ data: person }, config, locale] = await Promise.all([
    supabaseAdmin().from("customers").select("name, email").eq("id", input.customerId).maybeSingle(),
    getRewardsConfig(),
    customerLocale(input.customerId),
  ]);
  if (person) {
    await sendRewardsEmail({
      to: person.email,
      name: person.name,
      locale,
      email: adjustmentEmail(input.points, note, balance + input.points, config, locale),
    });
  }
  return { ok: true, balance: balance + input.points };
}

/* ------------------------------------------------------- what customers are told */

export interface OrderPoints {
  used: number;
  /** Earned on this order so far (after anything taken back). */
  earned: number;
  welcome: number;
  /** Still to come: paid or waiting, not delivered yet. */
  expected: number;
  /** The welcome bonus this order will also bring. */
  welcomeExpected: number;
}

/** Points on one order, for the confirmation page and email. Null when there's nothing to say. */
export async function orderPointsSummary(order: {
  id: string;
  customerId: string | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
}): Promise<OrderPoints | null> {
  const config = await getRewardsConfig();
  if (!config.enabled || !order.customerId) return null;
  const all = await orderRows(order.id);
  if (!all) return null;
  const rows = all.filter((r) => r.customer_id === order.customerId);
  const sum = (kinds: LedgerKind[]) =>
    rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.points, 0);

  const { data: row } = await supabaseAdmin()
    .from("orders")
    .select("points_redeemed")
    .eq("id", order.id)
    .maybeSingle();
  const done = order.status === "delivered" || order.status === "cancelled";

  let welcomeExpected = 0;
  if (!done && config.welcomePoints > 0) {
    const { data: welcomed } = await supabaseAdmin()
      .from("reward_ledger")
      .select("id")
      .eq("dedupe_key", `welcome:${order.customerId}`)
      .limit(1);
    welcomeExpected = welcomed?.length ? 0 : config.welcomePoints;
  }

  return {
    used: (row?.points_redeemed as number | undefined) ?? 0,
    earned: Math.max(sum(["earn", "clawback"]), 0),
    welcome: sum(["welcome"]),
    expected: done ? 0 : earnedPoints(order.subtotalCents, order.discountCents, config),
    welcomeExpected,
  };
}

/** The line for the order confirmation email. Null = say nothing. */
export async function confirmationPointsNote(
  order: Parameters<typeof orderPointsSummary>[0],
  locale: "nl" | "en"
): Promise<string | null> {
  try {
    const summary = await orderPointsSummary(order);
    if (!summary) return null;
    return confirmationNote({
      used: summary.used,
      expected: summary.expected,
      welcome: summary.welcomeExpected,
      locale,
    });
  } catch {
    return null;
  }
}

/** The line for the delivered, cancelled and refunded emails. Null = say nothing. */
export async function statusPointsNote(
  order: { id: string; customerId: string | null },
  kind: "delivered" | "cancelled" | "refunded",
  locale: "nl" | "en"
): Promise<string | null> {
  try {
    const config = await getRewardsConfig();
    if (!config.enabled || !order.customerId) return null;
    const [all, balance] = await Promise.all([orderRows(order.id), ledgerBalance(order.customerId)]);
    if (!all || balance === null) return null;
    const rows = all.filter((r) => r.customer_id === order.customerId);
    const sum = (k: LedgerKind) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.points, 0);

    if (kind === "delivered") {
      return deliveredNote({ earned: sum("earn"), welcome: sum("welcome"), balance, config, locale });
    }
    return reversalNote({ restored: sum("restore"), removed: -sum("clawback"), balance, config, locale });
  } catch {
    return null;
  }
}

/** Points per order, for the customer's own order list. */
export async function pointsByOrder(
  customerId: string
): Promise<Map<string, { earned: number; used: number }>> {
  const { data, error } = await supabaseAdmin()
    .from("reward_ledger")
    .select("order_id, kind, points")
    .eq("customer_id", customerId)
    .not("order_id", "is", null)
    .limit(1000);
  const map = new Map<string, { earned: number; used: number }>();
  if (error) return map;
  for (const row of data ?? []) {
    const entry = map.get(row.order_id) ?? { earned: 0, used: 0 };
    if (row.kind === "earn" || row.kind === "welcome" || row.kind === "clawback") entry.earned += row.points;
    if (row.kind === "redeem" || row.kind === "restore") entry.used -= row.points;
    map.set(row.order_id, entry);
  }
  return map;
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
    referral: 0,
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
