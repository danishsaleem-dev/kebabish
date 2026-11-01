import "server-only";
import { randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getRewardsConfig } from "@/lib/rewards";
import { normalizeEmail, referralDiscountCents } from "@/lib/rewards-math";
import { normalizeDutchPhone } from "@/lib/phone";
import { siteConfig } from "@/lib/site-config";

/**
 * Referrals: codes and the check that a friend really is new. Paying out and reversing live in
 * rewards.ts with the rest of the ledger. A referral code is typed or carried in exactly like a
 * promo code, so a friend needs no account and checkout has no second code box.
 *
 * Reads degrade like everything else in rewards: until migration 0030 is run a code simply
 * isn't found and the dashboard shows no referral card.
 */

/** No 0/O or 1/I: these get read out over the phone and retyped from a screenshot. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newCode(): string {
  let code = "KB-";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** This customer's code, made the first time it is asked for. Null if not set up. */
export async function getReferralCode(customerId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("customer_referral_codes")
    .select("code")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) return null;
  if (data) return data.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error: insertError } = await db
      .from("customer_referral_codes")
      .insert({ customer_id: customerId, code });
    if (!insertError) return code;
    if (insertError.code !== "23505") return null;
    // Two tabs at once: the other one's code is the right one.
    const { data: again } = await db
      .from("customer_referral_codes")
      .select("code")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (again) return again.code;
  }
  return null;
}

/** The link a customer shares. It opens in the language they use the site in. */
export function referralLink(code: string, locale: string): string {
  return `${siteConfig.website}${locale === "en" ? "/en" : ""}/referral?code=${code}`;
}

/** The message that goes with it, ready to send. */
export function referralShareText(code: string, amount: string, locale: string): string {
  const link = referralLink(code, locale);
  return locale === "en"
    ? `Try Kebabish! With my link you get ${amount} off your first order: ${link}`
    : `Probeer Kebabish eens! Met mijn link krijg je ${amount} korting op je eerste bestelling: ${link}`;
}

export type ReferralResult =
  | { ok: true; code: string; referrerId: string; discountCents: number }
  | { ok: false; error: "notFound" | "referralOwn" | "referralNotNew" };

/** Has anyone with this email, phone or address already had a paid order? */
async function hasOrderedBefore(friend: {
  email?: string;
  phone?: string;
  postcode?: string;
  street?: string;
  customerId?: string | null;
}): Promise<boolean> {
  const paid = () =>
    supabaseAdmin().from("orders").select("id").in("payment_status", ["paid", "refunded"]).limit(1);
  const checks = [];
  if (friend.customerId) checks.push(paid().eq("customer_id", friend.customerId));
  if (friend.email) {
    const clean = normalizeEmail(friend.email);
    const [local, domain] = clean.split("@");
    checks.push(paid().ilike("customer_email", friend.email.trim()));
    // The same mailbox with or without a +tag.
    if (domain) {
      checks.push(paid().ilike("customer_email", clean));
      checks.push(paid().ilike("customer_email", `${local}+%@${domain}`));
    }
  }
  if (friend.phone) checks.push(paid().eq("customer_phone", friend.phone));
  if (friend.postcode && friend.street) {
    checks.push(paid().eq("address_postcode", friend.postcode).ilike("address_street", friend.street));
  }
  const results = await Promise.all(checks);
  return results.some((r) => (r.data?.length ?? 0) > 0);
}

/**
 * Is this code a real referral this person may use?
 *
 * Called twice, like a promo code: as a preview with whatever is known, and again inside
 * `checkoutAction` with the real email, phone and address, which is the check that counts.
 */
export async function validateReferral(
  rawCode: string,
  foodCents: number,
  friend: { email?: string; phone?: string; postcode?: string; street?: string; customerId?: string | null }
): Promise<ReferralResult> {
  const config = await getRewardsConfig();
  if (!config.enabled || !config.referralEnabled) return { ok: false, error: "notFound" };

  const code = rawCode.trim().toUpperCase();
  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("customer_referral_codes")
    .select("customer_id")
    .eq("code", code)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "notFound" };

  if (friend.customerId === row.customer_id) return { ok: false, error: "referralOwn" };

  const { data: referrer } = await db
    .from("customers")
    .select("email, phone")
    .eq("id", row.customer_id)
    .maybeSingle();
  if (referrer) {
    const sameEmail =
      friend.email && normalizeEmail(friend.email) === normalizeEmail(referrer.email);
    const samePhone =
      friend.phone && referrer.phone && normalizeDutchPhone(referrer.phone) === friend.phone;
    if (sameEmail || samePhone) return { ok: false, error: "referralOwn" };
  }

  if (await hasOrderedBefore(friend)) return { ok: false, error: "referralNotNew" };

  return {
    ok: true,
    code,
    referrerId: row.customer_id,
    discountCents: referralDiscountCents(foodCents, config),
  };
}

/** Remember which order came through which code. Never fails the order. */
export async function recordReferral(orderId: string, referrerId: string, code: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("referrals")
    .insert({ order_id: orderId, referrer_id: referrerId, code });
  if (error) console.error("[referrals] could not record a referral:", error.message);
}

export interface ReferralStats {
  /** Friends' orders still on their way to being delivered. */
  pending: number;
  rewarded: number;
  pointsEarned: number;
}

/** Counts only: a customer never sees who used their code. */
export async function referralStats(customerId: string): Promise<ReferralStats> {
  const { data } = await supabaseAdmin()
    .from("referrals")
    .select("status, points")
    .eq("referrer_id", customerId);
  const rows = data ?? [];
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    rewarded: rows.filter((r) => r.status === "rewarded").length,
    pointsEarned: rows
      .filter((r) => r.status === "rewarded")
      .reduce((sum, r) => sum + (r.points as number), 0),
  };
}

export interface ReferralTrack {
  id: string;
  status: "pending" | "rewarded" | "capped" | "cancelled";
  points: number;
  createdAt: string;
}

/** Each invited friend's order as a step in the customer's tracker: no name, no order number. */
export async function referralTracks(customerId: string, limit = 10): Promise<ReferralTrack[]> {
  const { data } = await supabaseAdmin()
    .from("referrals")
    .select("id, status, points, created_at")
    .eq("referrer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    points: r.points,
    createdAt: r.created_at,
  }));
}

export interface AdminReferral {
  id: string;
  code: string;
  status: string;
  points: number;
  createdAt: string;
  referrerName: string;
  referrerEmail: string;
  orderId: string;
  orderReference: string | null;
  friendName: string | null;
}

/** The latest referrals, for staff to look over. */
export async function listReferrals(limit = 30): Promise<AdminReferral[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("referrals")
    .select("id, code, status, points, created_at, referrer_id, order_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const [{ data: people }, { data: orders }] = await Promise.all([
    db.from("customers").select("id, name, email").in("id", [...new Set(data.map((r) => r.referrer_id))]),
    db.from("orders").select("id, reference, customer_name").in("id", data.map((r) => r.order_id)),
  ]);
  const who = new Map((people ?? []).map((p) => [p.id, p]));
  const order = new Map((orders ?? []).map((o) => [o.id, o]));

  return data.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    points: r.points,
    createdAt: r.created_at,
    referrerName: who.get(r.referrer_id)?.name ?? "",
    referrerEmail: who.get(r.referrer_id)?.email ?? "",
    orderId: r.order_id,
    orderReference: order.get(r.order_id)?.reference ?? null,
    friendName: order.get(r.order_id)?.customer_name ?? null,
  }));
}
