import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ACCOUNT_SETUP_DAYS } from "@/lib/customers/account-rules";

/**
 * "Forgot my password", for staff and customers alike — they share one
 * /login page, so they share one reset flow. The email address decides
 * which table it is (admin_users first, then customers, the same priority
 * the sign-in itself uses).
 *
 * The link carries a signed token rather than a row in a reset table:
 *
 *   <type>.<account id>.<expiry>.<signature>
 *
 * The signature is an HMAC over those parts *plus a fingerprint of the
 * account's current password hash* (which never leaves the server). So the
 * link stops working the moment the password changes — it is single-use
 * without anything having to be stored or cleaned up — and it can't be
 * forged without the server secret.
 */

export type AccountType = "admin" | "customer";

export interface ResetAccount {
  type: AccountType;
  id: string;
  email: string;
  name: string;
  /** "" for an account with no password yet (one created at checkout). */
  passwordHash: string;
  /** False for an account whose owner has never chosen a password. */
  hasPassword: boolean;
}

const TABLE: Record<AccountType, string> = {
  admin: "admin_users",
  customer: "customers",
};

/** How long a reset link works. */
export const RESET_TOKEN_MINUTES = 60;
const SALT_ROUNDS = 12;

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is not set.");
  return value;
}

function signature(type: AccountType, id: string, expiry: number, passwordHash: string) {
  // Only a fingerprint of the hash goes into the signature, and the
  // signature itself is all that's in the link.
  const fingerprint = createHmac("sha256", secret()).update(passwordHash).digest("hex").slice(0, 24);
  return createHmac("sha256", secret())
    .update(`password-reset:${type}:${id}:${expiry}:${fingerprint}`)
    .digest("hex");
}

async function findByEmail(email: string): Promise<ResetAccount | null> {
  for (const type of ["admin", "customer"] as const) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE[type])
      .select("id, email, name, password_hash")
      .ilike("email", email.trim().replace(/[\%_]/g, (c) => "\\" + c))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      return {
        type,
        id: data.id,
        email: data.email,
        name: data.name,
        passwordHash: data.password_hash ?? "",
        hasPassword: Boolean(data.password_hash),
      };
    }
  }
  return null;
}

async function findById(type: AccountType, id: string): Promise<ResetAccount | null> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE[type])
    .select("id, email, name, password_hash")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    type,
    id: data.id,
    email: data.email,
    name: data.name,
    passwordHash: data.password_hash ?? "",
    hasPassword: Boolean(data.password_hash),
  };
}

/** The account behind an email address, and a fresh reset token for it — or null when there is none. */
export async function createResetTokenForEmail(
  email: string
): Promise<{ token: string; account: ResetAccount } | null> {
  const account = await findByEmail(email);
  if (!account) return null;

  const expiry = Date.now() + RESET_TOKEN_MINUTES * 60_000;
  const token = [
    account.type,
    account.id,
    expiry,
    signature(account.type, account.id, expiry, account.passwordHash),
  ].join(".");
  return { token, account };
}

/** The account a valid, unexpired, unused token belongs to — otherwise null. */
export async function verifyResetToken(token: string): Promise<ResetAccount | null> {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [type, id, expiryRaw, given] = parts;
  if (type !== "admin" && type !== "customer") return null;

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  const account = await findById(type, id);
  if (!account) return null;

  const expected = Buffer.from(signature(type, id, expiry, account.passwordHash));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return account;
}

/**
 * A link that lets the owner of a checkout-created account (no password yet) choose one.
 * Same signed-token mechanism as a reset link, with a longer life: it is the main way into
 * the account, and the customer may not open the email the same hour. Single use all the
 * same — it stops working the moment the password is set.
 */
export async function createAccountSetupToken(customerId: string): Promise<string | null> {
  const account = await findById("customer", customerId);
  if (!account) return null;
  const expiry = Date.now() + ACCOUNT_SETUP_DAYS * 86_400_000;
  return ["customer", account.id, expiry, signature("customer", account.id, expiry, account.passwordHash)].join(".");
}

/**
 * Write the new password. For a customer this also:
 *  - marks the email address confirmed (the link only ever went to that address), and
 *  - ends every sign-in issued before now (`sessions_valid_after`). That is what stops
 *    whoever typed somebody else's address at checkout from keeping a login on the real
 *    owner's account — and it is the right thing after any password reset.
 * If migration 0027 hasn't been run those two columns don't exist; the password is still
 * saved, so resetting a password never breaks because of it.
 */
export async function setAccountPassword(account: ResetAccount, newPassword: string) {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const supabase = supabaseAdmin();

  if (account.type === "customer") {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("customers")
      .update({ password_hash, sessions_valid_after: now, email_confirmed_at: now })
      .eq("id", account.id);
    if (!error) return;
    console.error("[password-reset] saving with the confirmation columns failed — has migration 0027 been run?", error.message);
  }

  const { error } = await supabase.from(TABLE[account.type]).update({ password_hash }).eq("id", account.id);
  if (error) throw new Error(error.message);
}
